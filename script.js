/* ==========================================================
   Medora Clinic - Front-end interactions (vanilla ES6+)
   Sections: config, helpers, nav, scroll effects, counters,
   doctors carousel, appointment form, map, image fallback
   ========================================================== */
'use strict';

document.documentElement.classList.add('js');

/* ---------- Config ---------- */
const CONFIG = {
  // Backend integration point: set this to your API URL when you have one.
  // While it is empty, the form is validated and a success screen is shown,
  // but NOTHING is sent or stored anywhere. See README.
  endpoint: '',
};

// Doctors available per specialty (keep in sync with the Doctors section)
const DOCTORS = {
  'Cardiology': ['Dr. Karim Haddad'],
  'Pediatrics': ['Dr. Salma Reyad'],
  'Dermatology': ['Dr. Laila Mansour'],
  'Orthopedics': ['Dr. Omar Farouk'],
  'Neurology': ['Dr. Nour El-Sayed'],
  'Ophthalmology': [],
  'General Consultation': [],
  'Dental Care': [],
};

/* ---------- Helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- Mobile navigation ---------- */
const header = $('.site-header');
const toggle = $('#nav-toggle');
const menu = $('#nav-menu');

function setMenu(open) {
  menu.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  document.body.classList.toggle('menu-open', open);
}
toggle.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
$$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
window.matchMedia('(min-width: 960px)').addEventListener('change', e => { if (e.matches) setMenu(false); });

/* ---------- Scroll effects: header shadow, back-to-top, active link ---------- */
const toTop = $('#to-top');
const onScroll = () => {
  header.classList.toggle('scrolled', window.scrollY > 10);
  toTop.classList.toggle('show', window.scrollY > 700);
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();
toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

const navLinks = $$('.nav-link');
const sections = navLinks.map(l => $(l.getAttribute('href'))).filter(Boolean);
const spy = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === `#${entry.target.id}`));
    }
  });
}, { rootMargin: '-45% 0px -50% 0px' });
sections.forEach(s => spy.observe(s));

/* ---------- Reveal on scroll ---------- */
const revealEls = $$('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('in'); obs.unobserve(entry.target); }
    });
  }, { threshold: 0.12 });
  // Stagger siblings slightly for a smoother cascade
  revealEls.forEach(el => {
    const index = [...el.parentElement.children].indexOf(el);
    el.style.setProperty('--d', `${Math.min(index, 5) * 70}ms`);
    io.observe(el);
  });
} else {
  revealEls.forEach(el => el.classList.add('in'));
}

/* ---------- Animated counters (hero trust indicators) ---------- */
const counters = $$('[data-count]');
const countObs = new IntersectionObserver((entries, obs) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.textContent = target + suffix; obs.unobserve(el); return; }
    const start = performance.now(), dur = 1400;
    const tick = now => {
      const p = Math.min((now - start) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    obs.unobserve(el);
  });
}, { threshold: 0.6 });
counters.forEach(c => countObs.observe(c));

/* ---------- Doctors carousel buttons ---------- */
const track = $('#doctors-track');
const scrollTrack = dir => {
  const card = $('.doctor', track);
  const step = card ? card.getBoundingClientRect().width + 20 : 300;
  track.scrollBy({ left: dir * step, behavior: 'smooth' });
};
$('#doc-prev').addEventListener('click', () => scrollTrack(-1));
$('#doc-next').addEventListener('click', () => scrollTrack(1));
track.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') scrollTrack(1);
  if (e.key === 'ArrowLeft') scrollTrack(-1);
});

/* ---------- Appointment form ---------- */
const form = $('#appointment-form');
const fields = {
  name: $('#name'), email: $('#email'), phone: $('#phone'),
  specialty: $('#specialty'), doctor: $('#doctor'), date: $('#date'), message: $('#message'),
};

// Date: no past dates, default max one year ahead
const toISO = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
const today = new Date();
const maxDate = new Date(); maxDate.setFullYear(today.getFullYear() + 1);
fields.date.min = toISO(today);
fields.date.max = toISO(maxDate);

// Doctor list follows the chosen specialty
function populateDoctors(specialty, selected = '') {
  const select = fields.doctor;
  const hint = $('#doctor-hint');
  const list = specialty ? (DOCTORS[specialty] || []) : Object.values(DOCTORS).flat();
  select.innerHTML = '<option value="">Any available doctor</option>' +
    list.map(n => `<option value="${n}">${n}</option>`).join('');
  select.value = list.includes(selected) ? selected : '';
  hint.textContent = specialty && !list.length ? 'Our team will assign the best available doctor.' : '';
}
populateDoctors('');
fields.specialty.addEventListener('change', () => { populateDoctors(fields.specialty.value); validateField('specialty'); });

// Validators return an error message, or '' if valid
const validators = {
  name: v => v.trim().length < 3 ? 'Please enter your full name.' : (/\d/.test(v) ? 'Names cannot contain numbers.' : ''),
  email: v => !v.trim() ? 'Email address is required.' : (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter a valid email, e.g. name@example.com.'),
  phone: v => {
    const digits = v.replace(/\D/g, '');
    if (!v.trim()) return 'Phone number is required.';
    if (!/^[+\d\s()-]+$/.test(v)) return 'Use digits, spaces, + or - only.';
    return digits.length >= 8 && digits.length <= 15 ? '' : 'Enter a valid phone number (8–15 digits).';
  },
  specialty: v => v ? '' : 'Please choose a specialty.',
  date: v => {
    if (!v) return 'Please choose a preferred date.';
    if (v < fields.date.min) return 'Please choose today or a future date.';
    if (v > fields.date.max) return 'Please choose a date within the next year.';
    return '';
  },
};

function validateField(key) {
  const rule = validators[key];
  if (!rule) return true;
  const input = fields[key];
  const wrap = input.closest('.field');
  const err = $(`#${key}-error`);
  const msg = rule(input.value);
  wrap.classList.toggle('invalid', !!msg);
  wrap.classList.toggle('valid', !msg && !!input.value);
  input.setAttribute('aria-invalid', String(!!msg));
  err.textContent = msg;
  return !msg;
}

Object.keys(validators).forEach(key => {
  fields[key].addEventListener('blur', () => validateField(key));
  fields[key].addEventListener('input', () => {
    if (fields[key].closest('.field').classList.contains('invalid')) validateField(key);
  });
});

const success = $('#success');
const submitBtn = $('#submit-btn');

form.addEventListener('submit', async e => {
  e.preventDefault();
  const results = Object.keys(validators).map(validateField);
  if (results.includes(false)) {
    const firstBad = Object.keys(validators).find(k => fields[k].closest('.field').classList.contains('invalid'));
    fields[firstBad].focus();
    return;
  }

  const payload = {
    name: fields.name.value.trim(), email: fields.email.value.trim(), phone: fields.phone.value.trim(),
    specialty: fields.specialty.value, doctor: fields.doctor.value || 'Any available doctor',
    date: fields.date.value, message: fields.message.value.trim(),
  };

  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending…';

  try {
    // Real backend: only runs if CONFIG.endpoint is set. Otherwise this is a front-end demo only.
    if (CONFIG.endpoint) {
      const res = await fetch(CONFIG.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
    } else {
      await new Promise(r => setTimeout(r, 700)); // simulate network delay
    }
    showSuccess(payload);
  } catch (err) {
    console.error(err);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Appointment Request';
    alert('Sorry, we could not send your request. Please try again or call us.');
  }
});

function showSuccess(data) {
  const niceDate = new Date(data.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const rows = [['Patient', data.name], ['Specialty', data.specialty], ['Doctor', data.doctor], ['Preferred date', niceDate]];
  $('#summary').replaceChildren(...rows.map(([k, v]) => {
    const row = document.createElement('div');
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;   // textContent: safe against HTML injection
    row.append(dt, dd);
    return row;
  }));
  $('#success-text').textContent = `Thank you, ${data.name.split(' ')[0]}. We will contact you at ${data.email} or ${data.phone} to confirm your appointment.`;
  form.hidden = true;
  success.hidden = false;
  success.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

$('#new-request').addEventListener('click', () => {
  form.reset();
  $$('.field', form).forEach(f => f.classList.remove('valid', 'invalid'));
  $$('.error', form).forEach(e => (e.textContent = ''));
  populateDoctors('');
  submitBtn.disabled = false;
  submitBtn.textContent = 'Submit Appointment Request';
  success.hidden = true;
  form.hidden = false;
  fields.name.focus();
});

/* ---------- Pre-fill the form from specialty / doctor buttons ---------- */
$$('[data-specialty]').forEach(el => {
  if (!el.matches('a')) return; // only the clickable specialty cards
  el.addEventListener('click', () => {
    fields.specialty.value = el.dataset.specialty;
    populateDoctors(el.dataset.specialty);
    validateField('specialty');
  });
});
$$('[data-doctor]').forEach(el => {
  el.addEventListener('click', () => {
    const specialty = el.closest('.doctor').dataset.specialty;
    fields.specialty.value = specialty;
    populateDoctors(specialty, el.dataset.doctor);
    validateField('specialty');
  });
});

/* ---------- Google Maps embed (optional) ---------- */
// Paste your embed URL into the iframe's data-src attribute in index.html.
const frame = $('#map-frame');
if (frame.dataset.src) {
  frame.src = frame.dataset.src;
  frame.hidden = false;
  $('#map-placeholder').hidden = true;
}

/* ---------- Image fallback: never show a broken image ---------- */
$$('img').forEach(img => {
  img.addEventListener('error', () => {
    img.style.visibility = 'hidden';
    (img.parentElement || img).classList.add('img-fallback');
  }, { once: true });
});

/* ---------- Footer year ---------- */
$('#year').textContent = new Date().getFullYear();
