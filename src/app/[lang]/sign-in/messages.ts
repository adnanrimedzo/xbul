import { defineMessages } from '@/i18n/locales';

export const SIGN_IN = defineMessages({
  en: {
    title: 'Sign in',
    intro: 'We email you a link, so there is no password to remember. New here? The same steps create your account.',
    orContinueWith: 'or continue with',
    providerFailed: "We couldn't sign you in with that account. Try again, or use an email link instead.",
    sendFailed: "We couldn't send the link, so please try again in a minute.",
    checkEmail: 'Check your email',
    sent: 'We sent you a sign-in link. It works for 10 minutes.',
    email: 'Email',
    sendLink: 'Send link',
  },
  tr: {
    title: 'Giriş yap',
    intro: 'Size e-postayla bir link gönderiyoruz, böylece hatırlamanız gereken bir şifre olmuyor. Yeni misiniz? Aynı adımlarla hesabınız oluşturulur.',
    orContinueWith: 'veya şununla devam edin',
    providerFailed: 'Bu hesapla giriş yapamadık. Tekrar deneyin ya da bunun yerine e-posta linki kullanın.',
    sendFailed: 'Link gönderilemedi. Lütfen bir dakika sonra tekrar deneyin.',
    checkEmail: 'E-postanızı kontrol edin',
    sent: 'Size bir giriş linki gönderdik. Link 10 dakika geçerlidir.',
    email: 'E-posta',
    sendLink: 'Link gönder',
  },
});
