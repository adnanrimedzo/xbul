import { defineMessages } from '@/i18n/locales';

export const TERMS = defineMessages({
  en: {
    title: 'Terms',
    description: 'The terms for using xbul.io: what suppliers agree to, what Verified means and how buyers and suppliers deal with each other.',
    sections: [
      ['Who runs this site', 'This site is run by xbul. Contact: hello@xbul.io.'],
      ['What suppliers agree to', 'Suppliers are responsible for what they claim. You must have the right to share anything you upload, including documents that name your customers.'],
      ['What Verified means', 'Verified means an admin reviewed the supplier’s evidence for that product. It is not a guarantee of quality, price or delivery.'],
      ['Dealing with suppliers', 'Buyers and suppliers deal directly. xbul is not a party to their deals and is not responsible for them.'],
      ['Removing content', 'We can remove a claim or a supplier that is wrong or misleading.'],
    ] as [string, string][],
  },
  tr: {
    title: 'Kullanım koşulları',
    description: 'xbul.io’nun kullanım koşulları: üreticilerin neyi kabul ettiği, Doğrulandı’nın ne anlama geldiği ve alıcılarla üreticilerin nasıl çalıştığı.',
    sections: [
      ['Bu siteyi kim işletiyor', 'Bu site xbul tarafından işletilmektedir. İletişim: hello@xbul.io.'],
      ['Üreticilerin kabul ettikleri', 'Üreticiler yaptıkları beyanlardan kendileri sorumludur. Müşterilerinizin adının geçtiği belgeler dahil, yüklediğiniz her şeyi paylaşma hakkına sahip olmanız gerekir.'],
      ['Doğrulandı ne anlama gelir', 'Doğrulandı, bir yöneticinin üreticinin o ürüne ilişkin kanıtlarını incelediği anlamına gelir. Kalite, fiyat ya da teslimat için bir güvence değildir.'],
      ['Üreticilerle çalışma', 'Alıcılar ve üreticiler doğrudan çalışır. xbul aralarındaki anlaşmaların tarafı değildir ve bu anlaşmalardan sorumlu değildir.'],
      ['İçeriğin kaldırılması', 'Yanlış ya da yanıltıcı olan bir beyanı veya üreticiyi kaldırabiliriz.'],
    ],
  },
});
