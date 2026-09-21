/**
 * Chow45 Landing Page & Waitlist Scripts
 */

document.addEventListener('DOMContentLoaded', () => {
  // Mobile Navigation Menu Toggle
  const menuToggle = document.querySelector('.menu-toggle');
  const mobileMenu = document.querySelector('.mobile-menu');

  if (menuToggle && mobileMenu) {
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
  }

  // Waitlist Modal Dialog Setup
  const waitlistModal = document.querySelector('#waitlist-modal');
  const closeWaitlistButtons = document.querySelectorAll('[data-close-waitlist]');
  const modalForm = document.querySelector('#waitlist-form');
  const modalFormCard = waitlistModal ? waitlistModal.querySelector('.form-card') : null;
  const modalSuccessState = waitlistModal ? waitlistModal.querySelector('.success-state') : null;

  const closeWaitlist = () => {
    if (!waitlistModal) return;
    waitlistModal.classList.remove('open');
    waitlistModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  };

  const openWaitlist = (event, preselectRole) => {
    if (event && event.preventDefault) event.preventDefault();
    if (!waitlistModal) return;

    waitlistModal.classList.add('open');
    waitlistModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    if (modalForm) {
      modalForm.reset();
      modalForm.style.display = '';
      const header = modalFormCard ? modalFormCard.querySelector('.form-header') : null;
      if (header) header.style.display = '';
      if (modalSuccessState) modalSuccessState.classList.remove('visible');
    }

    let role = preselectRole || 'Student';
    if (!preselectRole && event) {
      const target = event.currentTarget || event.target;
      if (target) {
        if (target.hasAttribute('data-vendor-trigger')) role = 'Vendor';
        else if (target.hasAttribute('data-rider-trigger')) role = 'Rider';
      }
    }

    setModalRole(role);

    setTimeout(() => {
      const firstInput = modalForm ? modalForm.querySelector('input[name="name"]') : null;
      if (firstInput) firstInput.focus();
    }, 100);
  };

  // Role Chip Helpers
  function setModalRole(roleName) {
    const hiddenInput = document.querySelector('#modal-user-type-input');
    if (hiddenInput) hiddenInput.value = roleName;

    document.querySelectorAll('#modal-role-chips .role-chip').forEach(chip => {
      chip.classList.toggle('active', chip.getAttribute('data-role') === roleName);
    });
  }

  function setInlineRole(roleName) {
    const hiddenInput = document.querySelector('#inline-user-type-input');
    if (hiddenInput) hiddenInput.value = roleName;

    document.querySelectorAll('#inline-role-chips .role-chip').forEach(chip => {
      chip.classList.toggle('active', chip.getAttribute('data-role') === roleName);
    });
  }

  // Click listeners for modal role chips
  document.querySelectorAll('#modal-role-chips .role-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const role = chip.getAttribute('data-role');
      setModalRole(role);
    });
  });

  // Click listeners for inline role chips
  document.querySelectorAll('#inline-role-chips .role-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const role = chip.getAttribute('data-role');
      setInlineRole(role);
    });
  });

  // Waitlist Trigger buttons
  document.querySelectorAll('a[href="#waitlist"], [data-trigger-waitlist]').forEach((trigger) => {
    trigger.addEventListener('click', (e) => {
      // If trigger specifically targets a role
      let preselect = null;
      if (trigger.hasAttribute('data-vendor-trigger')) preselect = 'Vendor';
      if (trigger.hasAttribute('data-rider-trigger')) preselect = 'Rider';

      // Check if clicked from within hero or nav
      const isNavCta = trigger.classList.contains('nav-cta') || trigger.classList.contains('hero-action-btn') || trigger.classList.contains('button-lg');
      if (isNavCta) {
        openWaitlist(e, preselect);
      }
    });
  });

  document.querySelectorAll('[data-vendor-trigger]').forEach((trigger) => {
    trigger.addEventListener('click', (e) => openWaitlist(e, 'Vendor'));
  });

  document.querySelectorAll('[data-rider-trigger]').forEach((trigger) => {
    trigger.addEventListener('click', (e) => openWaitlist(e, 'Rider'));
  });

  closeWaitlistButtons.forEach((btn) => btn.addEventListener('click', closeWaitlist));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && waitlistModal && waitlistModal.classList.contains('open')) {
      closeWaitlist();
    }
  });

  // Submit Handler Generator for waitlist forms
  function setupWaitlistSubmission(formElement, successElement, headerElement) {
    if (!formElement) return;

    formElement.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!formElement.reportValidity()) return;

      const submitBtn = formElement.querySelector('button[type="submit"]');
      const originalLabel = submitBtn ? submitBtn.innerHTML : 'Submit';

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Reserving your spot...</span>';
      }

      const formData = new FormData(formElement);
      const waitlistEntry = {
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        user_type: formData.get('user_type') || 'Student',
        department: formData.get('department') || ''
      };

      try {
        const res = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(waitlistEntry)
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.warn('Waitlist API notice:', errData.error);
        }
      } catch (err) {
        console.warn('Network submission notice, continuing:', err.message);
      }

      // Local state record
      try {
        localStorage.setItem('chow45_user_waitlist', JSON.stringify(waitlistEntry));
      } catch (storageErr) {}

      // Reveal success confirmation
      formElement.style.display = 'none';
      if (headerElement) headerElement.style.display = 'none';
      if (successElement) successElement.classList.add('visible');

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalLabel;
      }
    });
  }

  // Attach submit listeners to both Modal Form & Inline Form
  if (modalForm) {
    const header = modalFormCard ? modalFormCard.querySelector('.form-header') : null;
    setupWaitlistSubmission(modalForm, modalSuccessState, header);
  }

  const inlineForm = document.querySelector('#inline-waitlist-form');
  const inlineSuccess = document.querySelector('#inline-success-state');
  if (inlineForm) {
    setupWaitlistSubmission(inlineForm, inlineSuccess, null);
  }

  // Scroll Reveal Animations
  const revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('visible'));
  }

  // Interactive FAQ Details Accordion
  document.querySelectorAll('.faq-item').forEach((detail) => {
    detail.addEventListener('toggle', () => {
      if (detail.open) {
        document.querySelectorAll('.faq-item[open]').forEach((other) => {
          if (other !== detail) other.removeAttribute('open');
        });
      }
    });
  });
});