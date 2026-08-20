(() => {
  const REFRESH_MS = 3000;

  const state = {
    token: '',
    timer: null,
    loading: false
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

    refresh();
    state.timer = setInterval(refresh, REFRESH_MS);
  }

  async function refresh() {
    if (state.loading) return;
    state.loading = true;

    try {
      const data = await DraftApi.loadAdminStatus(state.token);
      render(data);
      clearError();
    } catch (error) {
      showError(error.message);
    } finally {
      state.loading = false;
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

    const tbody = $('participant-rows');
    tbody.innerHTML = '';

    (data.participants || []).forEach((p) => {
      const tr = document.createElement('tr');

      tr.appendChild(cell(String(p.absoluteRank), 'rank-col'));
      tr.appendChild(cell(p.displayName, 'name-col'));
      tr.appendChild(answerCell(p));

      for (let i = 0; i < 3; i++) {
        tr.appendChild(roundCell(p.rounds?.[i]));
      }

      tr.appendChild(finalCell(p.finalAssignments || []));
      tbody.appendChild(tr);
    });

    $('status-panel').hidden = false;
  }

  function cell(text, className = '') {
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

  function roundCell(round) {
    const td = document.createElement('td');

    if (!round) {
      td.textContent = '未実施';
      td.className = 'round-empty';
      return td;
    }

    const genre = document.createElement('span');
    genre.className = 'round-genre';
    genre.textContent = round.genreName;
    td.appendChild(genre);

    if (round.preferenceRank) {
      const rank = document.createElement('span');
      rank.className = 'round-rank';
      rank.textContent = `第${round.preferenceRank}希望`;
      td.appendChild(rank);
    }

    return td;
  }

  function finalCell(assignments) {
    const td = document.createElement('td');
    td.className = 'final-col';

    if (!assignments.length) {
      td.textContent = '未確定';
      td.classList.add('final-empty');
      return td;
    }

    assignments.forEach((a, index) => {
      const line = document.createElement('span');
      line.className = 'final-item';

      const rank = a.preferenceRank
        ? `（第${a.preferenceRank}希望）`
        : '';

      line.textContent =
        `${index + 1}. ${a.genreName}${rank}`;

      td.appendChild(line);
    });

    return td;
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
