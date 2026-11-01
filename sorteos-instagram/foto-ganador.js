/* Complemento de avatar para la versión estática ya compilada.
   No consulta perfiles externos: la foto seleccionada permanece en este navegador. */
(() => {
  'use strict';
  let activeCard = null;
  let activeUser = '';
  let objectUrl = '';
  function releaseImage() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = '';
  }
  function sync() {
    const card = document.querySelector('.winner.winner-reveal');
    if (!card) {
      if (activeCard) { releaseImage(); activeCard = null; activeUser = ''; }
      return;
    }
    // Si una futura compilación React ya tiene la función nativa, no duplicarla.
    if (card.querySelector('.winner-avatar') && card !== activeCard) return;
    const heading = card.querySelector('h3');
    const user = heading && heading.textContent ? heading.textContent.trim().replace(/^@/, '') : '';
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(user)) return;
    if (card === activeCard) {
      if (user !== activeUser) {
        releaseImage();
        activeUser = user;
        const img = card.querySelector('.winner-avatar img');
        const initial = card.querySelector('.winner-avatar span');
        const link = card.querySelector('.winner-profile-link');
        const button = card.querySelector('.winner-photo-button');
        if (img) { img.removeAttribute('src'); img.hidden = true; }
        if (initial) { initial.textContent = user.charAt(0).toUpperCase(); initial.hidden = false; }
        if (link) link.href = 'https://www.instagram.com/' + encodeURIComponent(user) + '/';
        if (button) button.textContent = 'Agregar foto de perfil';
      }
      return;
    }
    releaseImage();
    activeCard = card;
    activeUser = user;
    card.classList.add('has-photo-feature');
    const avatar = document.createElement('div');
    avatar.className = 'winner-avatar';
    avatar.setAttribute('role', 'img');
    avatar.setAttribute('aria-label', 'Avatar de @' + user);
    const initial = document.createElement('span');
    initial.textContent = user.charAt(0).toUpperCase();
    initial.setAttribute('aria-hidden','true');
    const img = document.createElement('img');
    img.hidden = true;
    img.alt = 'Foto de @' + user;
    img.addEventListener('error', () => {
      img.hidden = true;
      initial.hidden = false;
    });
    avatar.append(initial,img);
    card.insertBefore(avatar, card.firstChild);
    const actions = document.createElement('div');
    actions.className = 'winner-photo-actions';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.className = 'winner-photo-input';
    input.setAttribute('aria-label','Seleccionar foto del ganador');
    const button = document.createElement('button');
    button.className = 'winner-photo-button';
    button.type = 'button';
    button.textContent = 'Agregar foto de perfil';
    button.addEventListener('click', () => input.click());
    const profile = document.createElement('a');
    profile.className = 'winner-profile-link';
    profile.textContent = 'Ver perfil de Instagram';
    profile.href = 'https://www.instagram.com/' + encodeURIComponent(user) + '/';
    profile.target = '_blank';
    profile.rel = 'noopener noreferrer';
    const error = document.createElement('p');
    error.className = 'winner-photo-error';
    error.setAttribute('role','alert');
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.value = '';
      error.textContent = '';
      if (!file) return;
      if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) {
        error.textContent = 'Selecciona una imagen de máximo 8 MB.';
        return;
      }
      releaseImage();
      objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
      img.hidden = false;
      initial.hidden = true;
      avatar.setAttribute('aria-label', 'Foto de perfil elegida para @' + activeUser);
      button.textContent = 'Cambiar foto';
    });
    actions.append(input,button,profile,error);
    const save = card.querySelector('button.secondary');
    if (save) card.insertBefore(actions,save);
    else card.append(actions);
  }
  const observer = new MutationObserver(sync);
  observer.observe(document.body, {subtree:true,childList:true,characterData:true});
  sync();
  window.addEventListener('pagehide', releaseImage, {once:true});
})();