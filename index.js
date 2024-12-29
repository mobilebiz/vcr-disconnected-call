import axios from 'axios';
import express from 'express';
import * as fs from 'node:fs';
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
        // Vonage AI Studio Insight API を使って、録音データを取得
        const URL = `https://studio-api-us.ai.vonage.com/insights/sessions/${req.body.session_id}`;
        const requestOptions = {
            headers: {
                'X-Vgai-Key': VONAGE_VGAI_KEY
            },
        };
        const response = await axios.get(URL, requestOptions);
        const data = response.data;
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

const saveRecordingFile = async (recording_url, conversation_uuid) => {
    // fetchを使って録音データをダウンロードする
    const requestOptions = {
        responseType: 'stream',
    };
    try {
        const response = await axios.get(recording_url, requestOptions);
        console.log(`🐞 Recording file streamm got.`);

        // 一時ファイルに保存
        const tmp_file_path = `/tmp/${conversation_uuid}.mp3`;
        const fileStream = fs.createWriteStream(tmp_file_path);
        response.data.pipe(fileStream);
        return new Promise((resolve, reject) => {
            fileStream.on('finish', () => {
                resolve(tmp_file_path);
            });
            fileStream.on('error', (err) => {
                throw err;
            });
        })
    } catch (error) {
        console.error(error);
        throw error;
    }
}

app.listen(port, () => {
    console.log(`App listening on port ${port}`)
});