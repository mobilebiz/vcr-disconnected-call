import axios from 'axios';
import express from 'express';
import * as fs from 'node:fs';
import { vcr } from '@vonage/vcr-sdk';
import { UploadRecordingFile, UpdateCallLogRecord } from "./lib/KintoneLib.js";

const app = express();
const port = process.env.VCR_PORT;

const {
    VONAGE_VGAI_KEY,
} = process.env;

app.use(express.json());
app.use(express.static('public'));

app.get('/_/health', async (req, res) => {
    res.sendStatus(200);
});

app.get('/_/metrics', async (req, res) => {
    res.sendStatus(200);
});

app.post('/event-disconnected-call', async (req, res) => {
    console.log(`🐞 event-disconnected-call received`);
    try {
        // Vonage AI Studio Insight API を使って、録音データを取得（audio_url が出るまでリトライ）
        const data = await fetchSessionWithAudioUrl(req.body.session_id);
        console.log(`🐞 parameters: ${JSON.stringify(data.parameters, null, 2)}`);
        console.log(`🐞 channel_data: ${JSON.stringify(data.channel_data, null, 2)}`);

        // 重複チェック
        // if (fs.existsSync(`/tmp/${data.parameters.CONVERSATION_ID}.mp3`)) {
        //     console.log(`🐞 Record already exists.`);
        //     res.sendStatus(200);
        //     return;
        // }

        // 録音データをローカルに保存
        const tmp_file_path = await saveRecordingFile(data.channel_data.audio_url, data.parameters.CONVERSATION_ID);
        console.log(`🐞 Recording file save to ${tmp_file_path}`);

        // 録音データをkintoneに格納
        const fileKey = await UploadRecordingFile(tmp_file_path);
        console.log(`🐞 fileKey: ${fileKey}`);

        // 着信ログを更新
        await UpdateCallLogRecord(data.parameters.CONVERSATION_ID, data.parameters['USER.RECORD_ID'], fileKey);
        console.log(`🐞 Record updated.`);

        // ローカルに保存した録音データを削除
        fs.unlinkSync(tmp_file_path);
        console.log(`🐞 Recording file deleted.`);

        res.sendStatus(200);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fetchSessionWithAudioUrl = async (session_id) => {
    // Insights API は通話終了直後だと channel_data が未確定なので、audio_url が入るまでリトライする
    const URL = `https://studio-api-us.ai.vonage.com/insights/sessions/${session_id}`;
    const requestOptions = {
        headers: { 'X-Vgai-Key': VONAGE_VGAI_KEY },
    };
    const maxRetries = 5;
    const baseDelayMs = 5000;

    let lastData = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const delay = attempt === 1 ? baseDelayMs : baseDelayMs * Math.pow(2, attempt - 2);
        console.log(`🐞 Waiting ${delay}ms before insights fetch (attempt ${attempt}/${maxRetries})`);
        await sleep(delay);

        const response = await axios.get(URL, requestOptions);
        lastData = response.data;
        if (lastData?.channel_data?.audio_url) {
            return lastData;
        }
        console.log(`🐞 audio_url not yet available. channel_data=${JSON.stringify(lastData?.channel_data)}`);
    }
    throw new Error('audio_url not available after retries');
};

const extractRecordingUrl = (audio_url) => {
    // audio_url は `https://stairway-.../recordings?token=<JWT>` の形式。JWT を decode して recordingUrl を取り出す
    const tokenMatch = audio_url.match(/[?&]token=([^&]+)/);
    if (!tokenMatch) throw new Error(`token not found in audio_url: ${audio_url}`);
    const payload = tokenMatch[1].split('.')[1];
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
    if (!decoded.recordingUrl) throw new Error(`recordingUrl not found in token payload`);
    return decoded.recordingUrl;
};

const saveRecordingFile = async (audio_url, conversation_uuid) => {
    // Stairway 経由ではリージョン跨ぎで 500 になるため、JWT 内の recordingUrl に Vonage Application JWT で直接アクセスする
    const recording_url = extractRecordingUrl(audio_url);
    console.log(`🐞 recording_url: ${recording_url}`);

    const maxRetries = 5;
    const baseDelayMs = 5000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const delay = attempt === 1 ? baseDelayMs : baseDelayMs * Math.pow(2, attempt - 2);
        console.log(`🐞 Waiting ${delay}ms before recording fetch (attempt ${attempt}/${maxRetries})`);
        await sleep(delay);

        try {
            const exp = Math.floor(Date.now() / 1000) + 300;
            const jwt = vcr.createVonageToken({ exp });
            const response = await axios.get(recording_url, {
                responseType: 'stream',
                headers: { Authorization: `Bearer ${jwt}` },
            });
            console.log(`🐞 Recording file stream got.`);

            const tmp_file_path = `/tmp/${conversation_uuid}.mp3`;
            const fileStream = fs.createWriteStream(tmp_file_path);
            response.data.pipe(fileStream);
            return await new Promise((resolve, reject) => {
                fileStream.on('finish', () => resolve(tmp_file_path));
                fileStream.on('error', reject);
            });
        } catch (error) {
            if (error.response && error.response.data && typeof error.response.data[Symbol.asyncIterator] === 'function') {
                try {
                    const chunks = [];
                    for await (const chunk of error.response.data) {
                        chunks.push(chunk);
                    }
                    const body = Buffer.concat(chunks).toString('utf-8');
                    console.error(`🐞 Error response body (attempt ${attempt}): ${body}`);
                } catch (e) { /* ignore */ }
            }
            const status = error.response?.status;
            const retryable = status === 404 || status === 500 || status === 502 || status === 503 || status === 504;
            if (!retryable || attempt === maxRetries) {
                console.error(error);
                throw error;
            }
            console.log(`🐞 Recording not ready yet (status ${status}). Will retry.`);
        }
    }
};

app.listen(port, () => {
    console.log(`App listening on port ${port}`)
});