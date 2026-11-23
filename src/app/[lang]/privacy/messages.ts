import { defineMessages } from '@/i18n/locales';

export const PRIVACY = defineMessages({
  en: {
    title: 'Privacy',
    description: 'What xbul.io keeps about you, who can see it, how long it is kept and how to have it corrected or deleted.',
    sections: [
      ['Who runs this site', 'This site is run by xbul. Contact: hello@xbul.io.'],
      ['Your account', 'We keep your email address to send you sign-in links. If you choose Google or Microsoft to sign in, they send us your name, email address and profile photo link, and sign-in tokens that we keep encrypted. When you sign in, your session records your IP address and browser, and that record can stay after you stop using the site. We also count sign-in attempts by IP address to limit abuse.'],
      ['Supplier details', 'A supplier’s company name, city, country and contact details are public, because buyers use them to get in touch. So are the products it tags and their specifications. The contact email starts as your sign-in email unless you change it.'],
      ['Documents you upload', 'Invoices and similar documents can be seen only by the supplier who uploaded them and by our admins. They are deleted when the claim is decided, withdrawn or changed, and in any case after 90 days.'],
      ['Searches', 'When you search, we count the search and whether it found a product. That count stores no IP address, only a hash that changes daily.'],
      ['Photo searches', 'When you search with a photo, Cloudflare Workers AI checks what it shows and turns it into numbers we compare with suppliers’ photos; Cloudflare does not keep it or use it for training. Your photo, browser-resized with its location and camera data removed, is kept privately for 7 days so you can come back to the results, then deleted. Anyone with the results link can see it during that time. A photo we can’t use is never stored. We count photo searches with the same daily hash to limit abuse.'],
      ['Supplier product photos', 'Photos a supplier adds of its products are public once published, on its page and in search results. Location and camera data are removed before upload. The supplier can unpublish or delete them at any time.'],
      ['Backups', 'Database backups are kept for 90 days. Uploaded documents are not in them, but their file names are.'],
      ['Service providers', 'We use Cloudflare for hosting and file storage, Neon for the database, Resend for email and GitHub to run backups. They process this data for us. Google and Microsoft confirm who you are only when you choose them to sign in. Cloudflare’s logs can hold request details, such as IP addresses, for a short time. Product images load directly from brand sites, which can see your IP address.'],
      ['Your choices', 'To see, correct or delete your data, email hello@xbul.io.'],
    ] as [string, string][],
  },
  tr: {
    title: 'Gizlilik',
    description: 'xbul.io’nun sizinle ilgili hangi bilgileri sakladığı, bunları kimin görebildiği, ne kadar süre saklandığı ve nasıl düzelttirip sildirebileceğiniz.',
    sections: [
      ['Bu siteyi kim işletiyor', 'Bu site xbul tarafından işletilmektedir. İletişim: hello@xbul.io.'],
      ['Hesabınız', 'Size giriş linkleri gönderebilmek için e-posta adresinizi saklarız. Giriş için Google veya Microsoft’u seçerseniz bize adınızı, e-posta adresinizi ve profil fotoğrafı linkinizi, ayrıca şifreli olarak sakladığımız giriş anahtarlarını gönderirler. Giriş yaptığınızda oturumunuz IP adresinizi ve tarayıcınızı kaydeder; bu kayıt, siteyi kullanmayı bıraktıktan sonra da kalabilir. Kötüye kullanımı sınırlamak için giriş denemelerini de IP adresine göre sayarız.'],
      ['Üretici bilgileri', 'Bir üreticinin şirket adı, şehri, ülkesi ve iletişim bilgileri herkese açıktır, çünkü alıcılar bunları iletişime geçmek için kullanır. Etiketlediği ürünler ve bunların özellikleri de herkese açıktır. Siz değiştirmediğiniz sürece iletişim e-postası, giriş yaptığınız e-posta adresidir.'],
      ['Yüklediğiniz belgeler', 'Faturaları ve benzeri belgeleri yalnızca onları yükleyen üretici ve yöneticilerimiz görebilir. Bu belgeler, beyan karara bağlandığında, geri çekildiğinde ya da değiştirildiğinde ve her durumda 90 gün sonra silinir.'],
      ['Aramalar', 'Arama yaptığınızda aramayı ve bir ürün bulunup bulunmadığını sayarız. Bu sayım IP adresi saklamaz, yalnızca her gün değişen bir özet değeri (hash) saklar.'],
      ['Fotoğrafla aramalar', 'Fotoğrafla aradığınızda Cloudflare Workers AI fotoğrafın ne gösterdiğini kontrol eder ve onu üreticilerin fotoğraflarıyla karşılaştırdığımız sayılara dönüştürür; Cloudflare fotoğrafı saklamaz ve eğitim için kullanmaz. Tarayıcıda küçültülen ve konum ile kamera bilgileri silinen fotoğrafınız, sonuçlara geri dönebilmeniz için 7 gün gizli olarak saklanır, sonra silinir. Bu süre içinde sonuç linkine sahip olan herkes onu görebilir. Kullanamadığımız bir fotoğraf hiç saklanmaz. Kötüye kullanımı sınırlamak için fotoğrafla aramaları aynı günlük özet değeriyle sayarız.'],
      ['Üreticilerin ürün fotoğrafları', 'Bir üreticinin ürünleri için eklediği fotoğraflar yayınlandıktan sonra sayfasında ve arama sonuçlarında herkese açıktır. Konum ve kamera bilgileri yüklemeden önce silinir. Üretici bunları istediği zaman yayından kaldırabilir ya da silebilir.'],
      ['Yedekler', 'Veritabanı yedekleri 90 gün saklanır. Yüklenen belgeler yedeklerde yer almaz, ancak dosya adları yer alır.'],
      ['Hizmet sağlayıcılar', 'Barındırma ve dosya depolama için Cloudflare’i, veritabanı için Neon’u, e-posta için Resend’i ve yedekleri çalıştırmak için GitHub’ı kullanırız. Bu veriler onlar tarafından bizim adımıza işlenir. Google ve Microsoft, kimliğinizi yalnızca girişte onları seçtiğinizde doğrular. Cloudflare’in kayıtları, IP adresleri gibi istek bilgilerini kısa bir süre tutabilir. Ürün görselleri doğrudan marka sitelerinden yüklenir ve bu siteler IP adresinizi görebilir.'],
      ['Seçenekleriniz', 'Verilerinizi görmek, düzeltmek ya da silmek için hello@xbul.io adresine e-posta gönderin.'],
    ],
  },
});
