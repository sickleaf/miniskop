(() => {
  const state = {
    token: '',
    loading: false,
    data: null
  };

  const $ = (id) => document.getElementById(id);

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    state.token =
      new URLSearchParams(location.search).get('t') || '';

    if (!state.token) {
      showError('管理表示用tokenがありません。');
      return;
    }

    $('refresh-button').addEventListener('click', refresh);
    $('dialog-close').addEventListener('click', closeDialog);

    document.querySelectorAll('.round-link').forEach((button) => {
      button.addEventListener('click', () => {
        const round = Number(button.dataset.round);
        openRoundDialog(round);
      });
    });

    $('round-dialog').addEventListener('click', (event) => {
      if (event.target === $('round-dialog')) {
        closeDialog();
      }
    });

    refresh();
  }

  async function refresh() {
    if (state.loading) return;
    state.loading = true;
    $('refresh-button').disabled = true;
    $('refresh-button').textContent = '更新中…';

    try {
      const data = await DraftApi.loadAdminStatus(state.token);
      state.data = data;
      render(data);
      clearError();
    } catch (error) {
      showError(error.message);
    } finally {
      state.loading = false;
      $('refresh-button').disabled = false;
      $('refresh-button').textContent = '表示を更新';
    }
  }

  function render(data) {
    $('set-label').textContent =
      `${data.participantSetLabel} (${data.participantSet})`;

    $('reception-status').textContent =
      data.receptionStatus === 'OPEN' ? '受付中' : '受付終了';

    $('draft-status').textContent = data.draftStatus;
    $('progress-label').textContent = data.progressLabel;
    $('fetched-at').textContent = data.fetchedAt || '';

    const participants = data.participants || [];
    const splitIndex = Math.ceil(participants.length / 2);

    renderParticipantTable(
      $('participant-rows-left'),
      participants.slice(0, splitIndex)
    );

    renderParticipantTable(
      $('participant-rows-right'),
      participants.slice(splitIndex)
    );

    $('status-panel').hidden = false;
  }

  function renderParticipantTable(tbody, participants) {
    tbody.innerHTML = '';

    participants.forEach((p) => {
      const tr = document.createElement('tr');

      tr.appendChild(textCell(String(p.absoluteRank), 'rank-col'));
      tr.appendChild(textCell(p.displayName, 'name-col'));
      tr.appendChild(answerCell(p));
      tr.appendChild(finalCell(p.finalAssignments || []));

      tbody.appendChild(tr);
    });
  }

  function textCell(text, className = '') {
    const td = document.createElement('td');
    td.textContent = text;
    if (className) td.className = className;
    return td;
  }

  function answerCell(p) {
    const td = document.createElement('td');
    td.className = 'answer-col';

    const main = document.createElement('span');
    main.className = 'answer-main';
    main.textContent = p.answerStatus;
    td.appendChild(main);

    if (p.lastSubmittedAt) {
      const time = document.createElement('span');
      time.className = 'answer-time';
      time.textContent = p.lastSubmittedAt;
      td.appendChild(time);
    }

    return td;
  }

  function finalCell(assignments) {
    const td = document.createElement('td');
    td.className = 'final-col';

    /*
     * ドラフト前・途中で最終結果がまだ存在しない場合は空欄。
     */
    if (!assignments.length) {
      td.textContent = '';
      td.classList.add('final-empty');
      return td;
    }

    const wrap = document.createElement('div');
    wrap.className = 'final-items';

    assignments.forEach((a) => {
      const item = document.createElement('span');
      item.className = 'final-item';

      const genre = document.createElement('span');
      genre.textContent = a.genreName;
      item.appendChild(genre);

      if (a.preferenceRank) {
        const rank = document.createElement('span');
        rank.className = 'final-rank';
        rank.textContent = `（${a.preferenceRank}）`;
        item.appendChild(rank);
      }

      wrap.appendChild(item);
    });

    td.appendChild(wrap);
    return td;
  }

  function openRoundDialog(round) {
    if (!state.data) return;

    const dialog = $('round-dialog');
    const participants = state.data.participants || [];

    $('round-dialog-title').textContent =
      `第${round}巡 ドラフト結果`;

    const tbody = $('round-dialog-body');
    tbody.innerHTML = '';

    participants.forEach((p) => {
      const tr = document.createElement('tr');

      tr.appendChild(
        textCell(String(p.absoluteRank), 'dialog-rank-col')
      );
      tr.appendChild(
        textCell(p.displayName, 'dialog-name-col')
      );

      const resultTd = document.createElement('td');
      const result = p.rounds?.[round - 1];

      if (!result) {
        const empty = document.createElement('span');
        empty.className = 'round-result-empty';
        empty.textContent =
          state.data.completedRound >= round
            ? '取得結果なし'
            : '未実施';
        resultTd.appendChild(empty);
      } else {
        const genre = document.createElement('span');
        genre.className = 'round-result-genre';
        genre.textContent = result.genreName;
        resultTd.appendChild(genre);

        if (result.preferenceRank) {
          const rank = document.createElement('span');
          rank.className = 'round-result-rank';
          rank.textContent =
            `（第${result.preferenceRank}希望）`;
          resultTd.appendChild(rank);
        }
      }

      tr.appendChild(resultTd);
      tbody.appendChild(tr);
    });

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function closeDialog() {
    const dialog = $('round-dialog');

    if (typeof dialog.close === 'function' && dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  function showError(message) {
    $('error-message').textContent = message;
    $('error-panel').hidden = false;
  }

  function clearError() {
    $('error-panel').hidden = true;
    $('error-message').textContent = '';
  }
})();
