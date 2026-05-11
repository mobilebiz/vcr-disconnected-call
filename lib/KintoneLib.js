import { KintoneRestAPIClient } from '@kintone/rest-api-client';
import FormData from 'form-data';
import * as fs from 'node:fs';
import path from 'path';
import axios from 'axios';

const {
  KINTONE_DOMAIN,
  KINTONE_LOGS_APP_ID,
  KINTONE_LOGS_API_KEY,
  KINTONE_LOGS_FIELD_CODE_RECORDING
} = process.env;

if (!KINTONE_DOMAIN || !KINTONE_LOGS_APP_ID || !KINTONE_LOGS_API_KEY || !KINTONE_LOGS_FIELD_CODE_RECORDING) {
  throw new Error(`👺 ERROR: KINTONE_DOMAIN or KINTONE_LOGS_APP_ID or KINTONE_LOGS_API_KEY or KINTONE_LOGS_FIELD_CODE_RECORDING is not set`);
}

const kintoneClient = new KintoneRestAPIClient({
  baseUrl: `https://${KINTONE_DOMAIN}.cybozu.com`,
  auth: {
    apiToken: KINTONE_LOGS_API_KEY,
  },
});

/**
 * 着信ログを更新
 * @param conversation_uuid: CONVERSATION ID
 * @param file_key: FileKey
 * @returns result
 */
export const UpdateCallLogRecord = async (conversation_uuid, record_id, file_key) => {
  try {
    // レコードを更新
    const result = await kintoneClient.record.updateRecord({
      app: KINTONE_LOGS_APP_ID,
      id: record_id,
      record: {
        [KINTONE_LOGS_FIELD_CODE_RECORDING]: {
          value: [
            {
              contentType: 'audio/mpeg',
              fileKey: file_key,
              name: `${conversation_uuid}.mp3`
            },
          ],
        },
      },
    });
    console.log(`🐞 result: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    console.log(`🐞 error: ${JSON.stringify(error)}`);
    throw error;
  }
}

/**
 * 録音データをkintoneに格納する
 * @param recording_file_path: 録音データのローカル保管場所
 * @returns fileKey 保存したFileKey
 */
export const UploadRecordingFile = async (recording_file_path) => {
  try {
    // Upload file
    const url = `https://${KINTONE_DOMAIN}.cybozu.com/k/v1/file.json`;
    const form = new FormData();
    form.append('file', fs.createReadStream(recording_file_path), path.basename(recording_file_path));
    const config = {
      headers: {
        'X-Cybozu-API-Token': KINTONE_LOGS_API_KEY,
        'Content-Type': form.getHeaders()['content-type'],
      }
    };
    const response = await axios.post(url, form, config);
    console.log(`🐞 response.data: ${JSON.stringify(response.data)}`);
    return response.data.fileKey;
  } catch (error) {
    console.log(`🐞 error: ${JSON.stringify(error)}`);
    throw error;
  }
}