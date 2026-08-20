(() => {
  const state = {
    token: '',
    genres: [],
    ranking: [],
    savedRanking: [],
    participant: null,
    submitting: false,
    loadedAsAnswered: false,
    dirtyAfterAnswered: false
  };

  const $ = (id) => document.getElementById(id);

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    state.token = new URLSearchParams(location.search).get('t') || '';

    if (!state.token) {
      showError('個別URLのtokenがありません。');
      return;
    }

    try {
      const data = await DraftApi.loadParticipant(state.token);

      state.participant = data.participant;
      state.genres = data.genres || [];
      state.ranking = [...(data.ranking || [])];
      state.savedRanking = [...state.ranking];
      state.loadedAsAnswered = data.answerStatus === '回答済み';
      state.dirtyAfterAnswered = false;

      $('participant-name').textContent = state.participant.displayName;
      $('answer-status').textContent = data.answerStatus || '未回答';
      $('last-submitted').textContent = data.lastSubmittedAt
        ? `最終回答日時: ${data.lastSubmittedAt}`
        : '';

      $('status-message').textContent = '';
      $('participant-panel').hidden = false;

      if (data.resultConfirmed) {
        showResult(data.result);
        return;
      }

      if (!data.receptionOpen) {
        $('entry-panel').innerHTML =
          '<h2>回答受付は終了しています</h2>' +
          '<p>結果確定までお待ちください。</p>';
        return;
      }

      bindEvents();
      render();
    } catch (error) {
      showError(error.message);
    }
  }

  function bindEvents() {
    $('reset-button').addEventListener('click', () => {
      if (state.submitting) return;

      state.ranking = [];
      markRankingChanged();
      setSaveStatus('');
      render();
    });

    $('submit-button').addEventListener('click', submitAnswer);
  }

  function render() {
    renderGenres();
    renderRanking();

    $('progress-text').textContent =
      `${state.ranking.length} / ${state.genres.length} 選択済み`;

    renderAnswerChangeNotice();
    updateButtons();
  }

  function renderGenres() {
    const selectedIds = new Set(state.ranking);
    const container = $('genre-list');
    container.innerHTML = '';

    state.genres
      .filter((genre) => !selectedIds.has(genre.id))
      .forEach((genre) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'genre-button';
        button.textContent = genre.name;
        button.disabled = state.submitting;

        button.addEventListener('click', () => {
          if (state.submitting) return;

          state.ranking.push(genre.id);
          markRankingChanged();
          setSaveStatus('');
          render();
        });

        container.appendChild(button);
      });
  }

  function renderRanking() {
    const list = $('ranking-list');
    list.innerHTML = '';

    state.ranking.forEach((genreId, index) => {
      const genre = state.genres.find((g) => g.id === genreId);

      const li = document.createElement('li');
      li.className = 'ranking-item';

      const row = document.createElement('div');
      row.className = 'ranking-row';

      const moveControls = document.createElement('span');
      moveControls.className = 'ranking-move';

      // 表示順は「↓」「↑」。
      moveControls.append(
        makeMoveButton('↓', index, 1),
        makeMoveButton('↑', index, -1)
      );

      const name = document.createElement('span');
      name.className = 'ranking-name';
      name.textContent = genre ? genre.name : genreId;

      /*
       * 「変更前」の表示有無にかかわらず、必ずこの列を生成する。
       * 未変更時は visibility:hidden で領域だけ確保し、
       * ↑↓・ジャンル名・外すの位置を各行で揃える。
       */
      const oldRankElement = document.createElement('span');
      oldRankElement.className = 'ranking-old-rank';

      if (state.loadedAsAnswered && state.dirtyAfterAnswered) {
        const oldRank = getSavedRank(genreId);
        oldRankElement.textContent = oldRank
          ? `変更前: ${oldRank}`
          : '変更前: ―';
      } else {
        oldRankElement.textContent = '変更前: 00';
        oldRankElement.classList.add('empty');
        oldRankElement.setAttribute('aria-hidden', 'true');
      }

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'ranking-remove';
      remove.textContent = '外す';
      remove.disabled = state.submitting;

      remove.addEventListener('click', () => {
        if (state.submitting) return;

        state.ranking.splice(index, 1);
        markRankingChanged();
        setSaveStatus('');
        render();
      });

      row.append(
        moveControls,
        name,
        oldRankElement,
        remove
      );

      li.appendChild(row);
      list.appendChild(li);
    });
  }

  function makeMoveButton(label, index, delta) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;

    const destination = index + delta;
    button.disabled =
      state.submitting ||
      destination < 0 ||
      destination >= state.ranking.length;

    button.addEventListener('click', () => {
      if (state.submitting) return;

      [state.ranking[index], state.ranking[destination]] =
        [state.ranking[destination], state.ranking[index]];

      markRankingChanged();
      setSaveStatus('');
      render();
    });

    return button;
  }

  function markRankingChanged() {
    if (state.loadedAsAnswered) {
      /*
       * 「一度でも変更した場合」という仕様なので、
       * 元の順番へ戻しても、再保存するまでは変更済み表示を維持する。
       */
      state.dirtyAfterAnswered = true;
    }
  }

  function renderAnswerChangeNotice() {
    const notice = $('unsaved-warning');
    if (!notice) return;

    if (!state.loadedAsAnswered) {
      notice.hidden = true;
      return;
    }

    notice.hidden = false;

    if (state.dirtyAfterAnswered) {
      notice.className = 'unsaved-warning dirty';
      notice.textContent =
        '順位を変更しましたが、変更内容はまだ保存されていません。' +
        '「回答を保存」を押すまで変更は反映されません。';
    } else {
      notice.className = 'unsaved-warning neutral';
      notice.textContent =
        '前回の回答から変更できますが、' +
        '「回答を保存」を押すまで変更は反映されません。';
    }
  }

  function getSavedRank(genreId) {
    const index = state.savedRanking.indexOf(genreId);
    return index >= 0 ? index + 1 : null;
  }

  function updateButtons() {
    const complete =
      state.ranking.length > 0 &&
      state.ranking.length === state.genres.length;

    $('submit-button').disabled = state.submitting || !complete;
    $('reset-button').disabled = state.submitting;

    $('submit-button').textContent = state.submitting
      ? '回答送信中…'
      : '回答を保存';
  }

  async function submitAnswer() {
    if (
      state.submitting ||
      state.ranking.length !== state.genres.length
    ) {
      return;
    }

    const submittedRanking = [...state.ranking];

    setSubmitting(true);
    setSaveStatus('回答送信中…', 'sending');

    try {
      const data = await DraftApi.saveAnswer(
        state.token,
        submittedRanking
      );

      applySaveSuccess(
        data.submittedAt || '',
        submittedRanking
      );
    } catch (saveError) {
      /*
       * Apps Script側で書き込み済みなのに応答だけHTTPエラーになる場合は、
       * 現在回答を再取得し、送信順位と一致すれば保存成功として扱う。
       */
      try {
        setSaveStatus(
          '保存結果を確認しています…',
          'sending'
        );

        const check = await DraftApi.loadParticipant(state.token);

        if (isSameRanking(check.ranking || [], submittedRanking)) {
          applySaveSuccess(
            check.lastSubmittedAt || '',
            submittedRanking
          );
        } else {
          throw saveError;
        }
      } catch (verifyError) {
        const message =
          saveError && saveError.message
            ? saveError.message
            : '回答の保存に失敗しました。';

        setSaveStatus(
          `保存できたか確認できませんでした。${message}`,
          'error'
        );
        alert(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function applySaveSuccess(submittedAt, submittedRanking) {
    $('answer-status').textContent = '回答済み';
    $('last-submitted').textContent = submittedAt
      ? `最終回答日時: ${submittedAt}`
      : '';

    state.savedRanking = [...submittedRanking];
    state.loadedAsAnswered = true;
    state.dirtyAfterAnswered = false;

    setSaveStatus('回答を保存しました。', 'success');
    renderAnswerChangeNotice();
  }

  function setSubmitting(value) {
    state.submitting = value;
    render();
  }

  function setSaveStatus(message, type = '') {
    const element = $('save-status');
    if (!element) return;

    element.textContent = message;
    element.className = 'save-status';

    if (type) {
      element.classList.add(type);
    }
  }

  function isSameRanking(a, b) {
    if (a.length !== b.length) return false;

    return a.every(
      (value, index) => String(value) === String(b[index])
    );
  }

  function showResult(result) {
    $('entry-panel').hidden = true;
    $('result-panel').hidden = false;

    const container = $('result-list');
    container.innerHTML = '';

    if (!result) return;

    if (result.allocationType === 'RANDOM_UNANSWERED') {
      const note = document.createElement('p');
      note.className = 'result-note';
      note.textContent = '未回答のためランダム割り当て';
      container.appendChild(note);
    }

    const assignmentBlock = document.createElement('div');
    assignmentBlock.className = 'result-assignments';

    (result.assignments || []).forEach((item, index) => {
      const line = document.createElement('p');
      line.className = 'result-assignment-line';

      const slot = item.slot || (index + 1);
      const rank = item.preferenceRank
        ? `（第${item.preferenceRank}希望）`
        : '';

      line.textContent =
        `参加ジャンル${slot}： ${item.genreName} ${rank}`;

      assignmentBlock.appendChild(line);
    });

    container.appendChild(assignmentBlock);

    const historyTitle = document.createElement('h3');
    historyTitle.className = 'draft-result-title';
    historyTitle.textContent = '■ドラフト結果';
    container.appendChild(historyTitle);

    const history = result.draftHistory || [];

    if (!history.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent =
        result.allocationType === 'RANDOM_UNANSWERED'
          ? '未回答のためドラフト判定履歴はありません。'
          : 'ドラフト判定履歴はありません。';
      container.appendChild(empty);
      return;
    }

    history.forEach((item) => {
      const line = document.createElement('p');
      line.className = 'draft-history-line';
      line.textContent =
        `第${item.preferenceRank}希望（${item.genreName}）： ${item.status}`;
      container.appendChild(line);
    });
  }

  function showError(message) {
    $('status-message').textContent = '';
    $('error-message').textContent = message;
    $('error-panel').hidden = false;
  }
})();
