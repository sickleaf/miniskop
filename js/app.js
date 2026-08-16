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

    renderUnsavedWarning();
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

      // 仕様変更：↓ → ↑ の順に表示。
      moveControls.append(
        makeMoveButton('↓', index, 1),
        makeMoveButton('↑', index, -1)
      );

      const name = document.createElement('span');
      name.className = 'ranking-name';
      name.textContent = genre ? genre.name : genreId;

      row.append(moveControls, name);

      /*
       * 回答済みでページを開き、一度でも順位を変更した場合のみ、
       * 保存済みだった変更前順位を「外す」の手前に表示する。
       */
      if (state.loadedAsAnswered && state.dirtyAfterAnswered) {
        const oldRank = getSavedRank(genreId);
        const oldRankElement = document.createElement('span');
        oldRankElement.className = 'ranking-old-rank';
        oldRankElement.textContent = oldRank
          ? `変更前: ${oldRank}`
          : '変更前: ―';
        row.appendChild(oldRankElement);
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

      row.appendChild(remove);
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
       * 「一度でも変更した場合」という仕様のため、
       * その後たまたま元の並びへ戻しても、保存するまでは警告を残す。
       */
      state.dirtyAfterAnswered = true;
    }
  }

  function renderUnsavedWarning() {
    const warning = $('unsaved-warning');
    if (!warning) return;

    warning.hidden = !(
      state.loadedAsAnswered &&
      state.dirtyAfterAnswered
    );
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
       * Apps Script側で書き込みは完了しているのに、
       * Content Serviceの応答取得時だけHTTPエラーになるケースへの対策。
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

    /*
     * 保存成功した順位を新しい「変更前順位」の基準に更新する。
     * 以降さらに変更した場合は、この保存済み順位を表示する。
     */
    state.savedRanking = [...submittedRanking];
    state.loadedAsAnswered = true;
    state.dirtyAfterAnswered = false;

    setSaveStatus('回答を保存しました。', 'success');
    renderUnsavedWarning();
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
      note.textContent = '未回答のためランダム割り当て';
      container.appendChild(note);
    }

    (result.assignments || []).forEach((item) => {
      const p = document.createElement('p');

      const rejected = item.rejectedBefore?.length
        ? `（${item.rejectedBefore.join(' / ')}）`
        : '';

      const rank = item.preferenceRank
        ? ` 第${item.preferenceRank}希望`
        : '';

      p.textContent =
        `${item.genreName}${rank}${rejected}`;

      container.appendChild(p);
    });
  }

  function showError(message) {
    $('status-message').textContent = '';
    $('error-message').textContent = message;
    $('error-panel').hidden = false;
  }
})();
