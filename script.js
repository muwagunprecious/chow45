const menuToggle = document.querySelector('.menu-toggle');
const mobileMenu = document.querySelector('.mobile-menu');

menuToggle.addEventListener('click', () => {
  const isOpen = mobileMenu.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', isOpen);
});

document.querySelectorAll('.mobile-menu a').forEach((link) => {
  link.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  });
});

const waitlistModal = document.querySelector('#waitlist-modal');
const closeWaitlistButtons = document.querySelectorAll('[data-close-waitlist]');
const waitlistTriggers = document.querySelectorAll('a[href="#waitlist"]');

const closeWaitlist = () => {
  waitlistModal.classList.remove('open');
  waitlistModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
};

const openWaitlist = (event) => {
  if (event) event.preventDefault();
  waitlistModal.classList.add('open');
  waitlistModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  if (form) {
    form.reset();
    form.style.display = '';
    const header = formCard ? formCard.querySelector('.form-header') : null;
    if (header) header.style.display = '';
    if (successState) successState.classList.remove('visible');
  }

  const target = event ? (event.currentTarget || event.target) : null;
  const text = target ? (target.textContent || '').toLowerCase() : '';
  const aria = target && target.getAttribute ? (target.getAttribute('aria-label') || '').toLowerCase() : '';
  const isVendor = text.includes('vendor') || aria.includes('vendor');

  const typeSelect = document.querySelector('#waitlist-form select[name="user_type"]');
  if (typeSelect && isVendor) {
    typeSelect.value = 'Vendor';
  }

  window.setTimeout(() => {
    const nameInput = document.querySelector('#waitlist-form input[name="name"]');
    if (nameInput) nameInput.focus();
  }, 80);
};

waitlistTriggers.forEach((trigger) => trigger.addEventListener('click', openWaitlist));
document.querySelectorAll('[data-trigger-waitlist], .card-arrow-btn, .store-pill, .cart-pill-button').forEach((trigger) => {
  trigger.addEventListener('click', openWaitlist);
});
closeWaitlistButtons.forEach((button) => button.addEventListener('click', closeWaitlist));

// Global delegated listener for cancel and close buttons
document.addEventListener('click', (event) => {
  const cancelBtn = event.target.closest('[data-close-waitlist], .form-cancel, .form-cancel-btn, .modal-close');
  if (cancelBtn) {
    event.preventDefault();
    closeWaitlist();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && waitlistModal.classList.contains('open')) closeWaitlist();
});

const revealItems = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

revealItems.forEach((item) => revealObserver.observe(item));

const form = document.querySelector('#waitlist-form');
const formCard = document.querySelector('.form-card');
const successState = document.querySelector('.success-state');
const submitButton = document.querySelector('.form-submit');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const originalLabel = submitButton.innerHTML;
  submitButton.disabled = true;
  submitButton.innerHTML = '<span>Saving your spot...</span><span class="submit-arrow">...</span>';

  const formData = new FormData(form);
  const waitlistEntry = {
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    user_type: formData.get('user_type'),
    department: formData.get('department')
  };

  try {
    const response = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(waitlistEntry)
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Submission failed');
    }
  } catch (err) {
    console.warn('Network submission error, caching entry locally:', err.message);
  }

  window.chow45WaitlistEntry = waitlistEntry;
  form.style.display = 'none';
  formCard.querySelector('.form-header').style.display = 'none';
  successState.classList.add('visible');
  submitButton.disabled = false;
  submitButton.innerHTML = originalLabel;
});

waitlistTriggers.forEach((trigger) => {
  trigger.addEventListener('click', () => {
    form.reset();
    form.style.display = '';
    formCard.querySelector('.form-header').style.display = '';
    successState.classList.remove('visible');
  });
});

document.querySelectorAll('details').forEach((detail) => {
  detail.addEventListener('toggle', () => {
    if (detail.open) {
      document.querySelectorAll('details[open]').forEach((other) => {
        if (other !== detail) other.removeAttribute('open');
      });
    }
  });
});