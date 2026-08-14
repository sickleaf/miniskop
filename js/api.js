class DraftApiHttpError extends Error {
  constructor(status, message) {
    super(message || `API通信エラー: ${status}`);
    this.name = 'DraftApiHttpError';
    this.status = status;
  }
}

const DraftApi = {
  async request(action, payload = {}) {
    if (!APP_CONFIG.apiUrl) {
      throw new Error('Apps Script Web API URLが未設定です。');
    }

    let response;

    try {
      response = await fetch(APP_CONFIG.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({
          action,
          ...payload
        }),
        cache: 'no-store',
        redirect: 'follow'
      });
    } catch (error) {
      throw new Error(`APIへの接続に失敗しました: ${error.message}`);
    }

    if (!response.ok) {
      throw new DraftApiHttpError(
        response.status,
        `API通信エラー: ${response.status}`
      );
    }

    let data;

    try {
      data = await response.json();
    } catch (error) {
      throw new Error('API応答をJSONとして読み取れませんでした。');
    }

    if (!data.ok) {
      throw new Error(data.message || 'API処理に失敗しました。');
    }

    return data;
  },

  loadParticipant(token) {
    return this.request('loadParticipant', { token });
  },

  saveAnswer(token, ranking) {
    return this.request('saveAnswer', { token, ranking });
  }
};
