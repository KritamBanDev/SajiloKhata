/* SajiloKhata Contact Form - Step 3 */
(function () {
  function setAlert(type, text) {
    var alertBox = document.getElementById('contact-alert');
    if (!alertBox) return;
    alertBox.className = 'form-alert ' + type;
    alertBox.textContent = text;
    alertBox.style.display = 'block';
  }

  function clearAlert() {
    var alertBox = document.getElementById('contact-alert');
    if (!alertBox) return;
    alertBox.style.display = 'none';
    alertBox.textContent = '';
    alertBox.className = 'form-alert';
  }

  function isEmailValid(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validate(payload) {
    if (payload.name.length < 2) {
      return 'Please enter a valid full name.';
    }
    if (!isEmailValid(payload.email)) {
      return 'Please enter a valid email address.';
    }
    if (payload.subject.length < 3) {
      return 'Subject should be at least 3 characters.';
    }
    if (payload.message.length < 10) {
      return 'Message should be at least 10 characters.';
    }
    return '';
  }

  async function submitForm(event) {
    event.preventDefault();

    clearAlert();

    var form = event.target;
    var submitBtn = document.getElementById('contact-submit-btn');

    var payload = {
      name: String(form.name.value || '').trim(),
      email: String(form.email.value || '').trim(),
      subject: String(form.subject.value || '').trim(),
      message: String(form.message.value || '').trim()
    };

    var error = validate(payload);
    if (error) {
      setAlert('error', error);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
      var res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      var data = await res.json().catch(function () {
        return { success: false, message: 'Invalid server response.' };
      });

      if (!res.ok || !data.success) {
        setAlert('error', data.message || 'Unable to submit your inquiry at this moment.');
      } else {
        form.reset();
        setAlert('success', data.message || 'Your inquiry has been submitted successfully.');
      }
    } catch (err) {
      setAlert('error', 'Network issue. Please try again in a moment.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Inquiry';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('contact-form');
    if (!form) return;
    form.addEventListener('submit', submitForm);
  });
})();
