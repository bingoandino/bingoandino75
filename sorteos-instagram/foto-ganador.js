/* Presentación del ganador sin carga manual de fotografías.
   Solo añade un avatar con inicial y el enlace al perfil de Instagram. */
(() => {
  'use strict';
  let activeCard = null;
  let activeUser = '';
  function sync() {
    const card = document.querySelector('.winner.winner-reveal');
    if (!card) { activeCard = null; activeUser = ''; return; }
    // Una futura compilación con el avatar integrado no debe duplicarlo.
    if (card.querySelector('.winner-avatar') && card !== activeCard) return;
    const heading = card.querySelector('h3');
    const user = heading && heading.textContent ? heading.textContent.trim().replace(/^@/, '') : '';
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(user)) return;
    if (card === activeCard) {
      if (user !== activeUser) {
        activeUser = user;
        const initial = card.querySelector('.winner-avatar span');
        const link = card.querySelector('.winner-profile-link');
        if (initial) initial.textContent = user.charAt(0).toUpperCase();
        if (link) link.href = 'https://www.instagram.com/' + encodeURIComponent(user) + '/';
      }
      return;
    }
    activeCard = card;
    activeUser = user;
    card.classList.add('has-photo-feature');
    const avatar = document.createElement('div');
    avatar.className = 'winner-avatar';
    avatar.setAttribute('role', 'img');
    avatar.setAttribute('aria-label', 'Avatar de @' + user);
    const initial = document.createElement('span');
    initial.textContent = user.charAt(0).toUpperCase();
    initial.setAttribute('aria-hidden', 'true');
    avatar.append(initial);
    card.insertBefore(avatar, card.firstChild);
    const profile = document.createElement('a');
    profile.className = 'winner-profile-link';
    profile.textContent = 'Ver perfil de Instagram';
    profile.href = 'https://www.instagram.com/' + encodeURIComponent(user) + '/';
    profile.target = '_blank';
    profile.rel = 'noopener noreferrer';
    const save = card.querySelector('button.secondary');
    if (save) card.insertBefore(profile, save);
    else card.append(profile);
  }
  const observer = new MutationObserver(sync);
  observer.observe(document.body, {subtree: true, childList: true, characterData: true});
  sync();
})();
