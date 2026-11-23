import { defineMessages } from '@/i18n/locales';

// Home page copy. The home page says "supplier" and "product", never "mill" or "garment" (e2e/home.spec.ts).
export const HOME = defineMessages({
  en: {
    metaTitle: 'Who made this? Find the supplier behind any clothing product',
    metaDescription: 'Paste a product link from Zara, H&M, Mango or any brand and see the suppliers who made it or can make an equivalent. Contact them directly: no sign-up, no commission.',
    title: 'Who made this?',
    subtitle: 'Find the supplier behind any product.',
    linkLabel: 'Product link',
    placeholder: 'Paste a product link',
    find: 'Find suppliers',
    notFound: 'No supplier has tagged this product yet.',
    addIt: 'Are you the supplier? Add it',
    noSignUp: 'No sign-up needed.',
    photoSearch: 'Search with a photo',
    orPhoto: 'Or search with a photo',

    scene: {
      fabric: 'Fabric supplier',
      sewing: 'Clothing maker',
      madeThis: 'We made this',
      canMake: 'Can make an equivalent',
      verified: 'Verified',
    },

    brandsEyebrow: 'Brands',
    brandsTitle: 'Find who makes clothes for Zara, H&M, Mango and more',
    brandsBody: 'Paste a link from any brand’s website. These are some of the brands people look up most.',
    allBrands: 'See all brands',

    latest: 'Latest',
    recent: 'Recently tagged products',
    noProducts: 'No products tagged yet.',
    madeIt: (n: number) => `${n} made it`,
    canMakeIt: (n: number) => `${n} can make it`,
    tagged: 'Tagged',

    process: 'Process',
    how: 'How it works',
    steps: [
      ['Paste a link', 'Use a product page from any brand’s website.'],
      ['See who made it', 'Suppliers say whether they made it or can make an equivalent.'],
      ['Contact them directly', 'There are no agents, request forms or commissions. xbul.io takes no part in the deal.'],
    ] as [string, string][],

    audienceEyebrow: 'Who it’s for',
    audienceTitle: 'One link, the right supplier',
    audiences: [
      ['Brands and designers', 'Found a cut, a wash or a fabric you like? See who already makes it, then ask for your own run.'],
      ['Buyers and sourcing teams', 'Shortlist suppliers with proven experience in a product type before the first sample.'],
      ['Journalists and researchers', 'Trace where a product comes from, with claims a supplier has made publicly and evidence-reviewed badges.'],
      ['Suppliers', 'Show the work you’ve already done for well-known brands, without breaking a confidentiality agreement.'],
    ] as [string, string][],

    turkiyeEyebrow: 'Sourcing in Türkiye',
    turkiyeTitle: 'Why so many searches lead to Türkiye',
    turkiyeBody:
      'Türkiye sits between Europe and Asia, with the whole chain from yarn to finished clothing in one country. That makes it a common source for European brands that need short lead times.',
    hubs: [
      ['İstanbul', 'Clothing production, design offices and sourcing agents'],
      ['Bursa', 'Woven fabrics and technical textiles'],
      ['Denizli', 'Home textiles and towels'],
      ['Kahramanmaraş', 'Cotton yarn and denim fabric'],
    ] as [string, string][],
    source: 'Source',

    makers: 'For makers',
    makersTitle: 'Make things? Show the work you’ve already done.',
    makersBody: 'Create a page, tag the products you’ve made or can make, and send evidence to earn a Verified badge for a product.',
    addProducts: 'Add products',
    createPage: 'Create your page',
    tagsMean: 'What the tags mean',

    faqEyebrow: 'FAQ',
    faqTitle: 'Questions, answered',
    faq: [
      [
        'How do I find out who made a Zara or H&M product?',
        'Copy the product’s link from the brand’s website and paste it into xbul.io. If suppliers have tagged that product, you see each one, whether they made it or can make an equivalent, and how to contact them.',
      ],
      [
        'Does it work with any brand?',
        'Yes. Any product page from a brand’s website works. What you see depends on whether a supplier has tagged that product, so new or niche products may have no results yet.',
      ],
      [
        'What is the difference between “We made this” and “Can make an equivalent”?',
        '“We made this” means the supplier says they produced that exact product. “Can make an equivalent” means they can make a product of the same type and quality, but didn’t make this one.',
      ],
      [
        'What does Verified mean?',
        'xbul.io reviewed evidence, such as invoices or correspondence, that the supplier made that product. The documents stay private and are deleted after the decision. Verified is not a guarantee of quality, price or delivery.',
      ],
      [
        'Is xbul.io affiliated with Zara, H&M or other brands?',
        'No. Brand names are used only to identify products. Brands don’t endorse xbul.io, and suppliers’ claims are their own.',
      ],
      ['Do I need an account?', 'No. Searching needs no sign-up. Suppliers sign in with an email link to create their page and tag products.'],
      ['Does xbul.io take a commission?', 'No. You contact suppliers directly, and xbul.io takes no part in the deal: there are no agents, request forms or commissions.'],
    ] as [string, string][],

    ctaTitle: 'Got a product link?',
    ctaBody: 'Paste it at the top of this page and see who made it.',
    ctaButton: 'Find suppliers',
  },
  tr: {
    metaTitle: 'Bunu kim üretti? Herhangi bir kıyafetin arkasındaki üreticiyi bulun',
    metaDescription: 'Zara, H&M, Mango ya da herhangi bir markanın ürün linkini yapıştırın; ürünü üreten veya muadilini üretebilen üreticileri görün. Doğrudan iletişime geçin: üyelik yok, komisyon yok.',
    title: 'Bunu kim üretti?',
    subtitle: 'Herhangi bir ürünün arkasındaki üreticiyi bulun.',
    linkLabel: 'Ürün linki',
    placeholder: 'Bir ürün linki yapıştırın',
    find: 'Üreticileri bul',
    notFound: 'Bu ürünü henüz hiçbir üretici etiketlemedi.',
    addIt: 'Üreticisi siz misiniz? Ekleyin',
    noSignUp: 'Üyelik gerekmez.',
    photoSearch: 'Fotoğrafla arayın',
    orPhoto: 'Ya da fotoğrafla arayın',

    scene: {
      fabric: 'Kumaş üreticisi',
      sewing: 'Hazır giyim üreticisi',
      madeThis: 'Bunu biz ürettik',
      canMake: 'Muadilini üretebiliriz',
      verified: 'Doğrulandı',
    },

    brandsEyebrow: 'Markalar',
    brandsTitle: 'Zara, H&M, Mango ve daha fazlası için kimin ürettiğini bulun',
    brandsBody: 'Herhangi bir markanın sitesinden link yapıştırın. Bunlar en çok aranan markalardan bazıları.',
    allBrands: 'Tüm markalar',

    latest: 'En yeniler',
    recent: 'Son etiketlenen ürünler',
    noProducts: 'Henüz etiketlenmiş ürün yok.',
    madeIt: (n: number) => `${n} üretici üretti`,
    canMakeIt: (n: number) => `${n} üretici üretebilir`,
    tagged: 'Etiketlendi',

    process: 'Süreç',
    how: 'Nasıl çalışır',
    steps: [
      ['Link yapıştırın', 'Herhangi bir markanın sitesindeki ürün sayfasını kullanın.'],
      ['Kimin ürettiğini görün', 'Üreticiler ürünü kendilerinin mi ürettiğini, yoksa muadilini mi üretebileceklerini belirtir.'],
      ['Doğrudan iletişime geçin', 'Aracı, talep formu veya komisyon yok. xbul.io anlaşmanın tarafı değildir.'],
    ] as [string, string][],

    audienceEyebrow: 'Kimler için',
    audienceTitle: 'Tek link, doğru üretici',
    audiences: [
      ['Markalar ve tasarımcılar', 'Beğendiğiniz bir kalıp, yıkama veya kumaş mı buldunuz? Onu zaten kimin ürettiğini görün, sonra kendi üretiminizi isteyin.'],
      ['Satın alma ve tedarik ekipleri', 'İlk numuneden önce, o ürün tipinde deneyimi kanıtlanmış üreticileri listeleyin.'],
      ['Gazeteciler ve araştırmacılar', 'Bir ürünün nereden geldiğini, üreticilerin açıkça yaptığı beyanlar ve kanıtı incelenmiş rozetlerle takip edin.'],
      ['Üreticiler', 'Tanınmış markalar için yaptığınız işleri, gizlilik sözleşmelerini ihlal etmeden gösterin.'],
    ] as [string, string][],

    turkiyeEyebrow: 'Türkiye’de üretim',
    turkiyeTitle: 'Aramalar neden bu kadar sık Türkiye’ye çıkıyor',
    turkiyeBody:
      'Türkiye, Avrupa ile Asya arasında yer alıyor ve iplikten bitmiş kıyafete kadar bütün zincir tek ülkede. Bu yüzden kısa termin isteyen Avrupalı markaların sık başvurduğu bir kaynak.',
    hubs: [
      ['İstanbul', 'Hazır giyim üretimi, tasarım ofisleri ve tedarik acenteleri'],
      ['Bursa', 'Dokuma kumaşlar ve teknik tekstil'],
      ['Denizli', 'Ev tekstili ve havlu'],
      ['Kahramanmaraş', 'Pamuk ipliği ve denim kumaşı'],
    ] as [string, string][],
    source: 'Kaynak',

    makers: 'Üreticiler için',
    makersTitle: 'Üretim mi yapıyorsunuz? Yaptığınız işleri gösterin.',
    makersBody: 'Bir sayfa oluşturun, ürettiğiniz veya üretebileceğiniz ürünleri etiketleyin ve bir ürün için Doğrulandı rozeti almak üzere kanıt gönderin.',
    addProducts: 'Ürün ekle',
    createPage: 'Sayfanızı oluşturun',
    tagsMean: 'Etiketler ne anlama geliyor',

    faqEyebrow: 'SSS',
    faqTitle: 'Sık sorulan sorular',
    faq: [
      [
        'Bir Zara veya H&M ürününü kimin ürettiğini nasıl öğrenirim?',
        'Ürünün linkini markanın sitesinden kopyalayıp xbul.io’ya yapıştırın. O ürünü etiketleyen üreticiler varsa her birini, ürünü kendilerinin mi ürettiğini yoksa muadilini mi üretebileceğini ve onlara nasıl ulaşacağınızı görürsünüz.',
      ],
      [
        'Her markayla çalışıyor mu?',
        'Evet. Bir markanın sitesindeki her ürün sayfası çalışır. Ne göreceğiniz, o ürünü bir üreticinin etiketleyip etiketlemediğine bağlıdır; yeni veya niş ürünlerde henüz sonuç olmayabilir.',
      ],
      [
        '“Bunu biz ürettik” ile “Muadilini üretebiliriz” arasındaki fark nedir?',
        '“Bunu biz ürettik”, üreticinin tam olarak o ürünü ürettiğini beyan ettiği anlamına gelir. “Muadilini üretebiliriz” ise aynı tip ve kalitede bir ürün üretebileceği, ama bu ürünü üretmediği anlamına gelir.',
      ],
      [
        'Doğrulandı ne demek?',
        'xbul.io, üreticinin o ürünü ürettiğine dair fatura veya yazışma gibi kanıtları inceledi. Belgeler gizli kalır ve karardan sonra silinir. Doğrulandı; kalite, fiyat veya teslimat garantisi değildir.',
      ],
      [
        'xbul.io’nun Zara, H&M veya diğer markalarla bir bağlantısı var mı?',
        'Hayır. Marka adları yalnızca ürünleri tanımlamak için kullanılır. Markalar xbul.io’yu desteklemez; üreticilerin beyanları kendilerine aittir.',
      ],
      ['Hesap açmam gerekiyor mu?', 'Hayır. Arama yapmak için üyelik gerekmez. Üreticiler sayfalarını oluşturmak ve ürün etiketlemek için e-posta linkiyle giriş yapar.'],
      ['xbul.io komisyon alıyor mu?', 'Hayır. Üreticilerle doğrudan iletişime geçersiniz ve xbul.io anlaşmanın tarafı değildir: aracı, talep formu veya komisyon yoktur.'],
    ] as [string, string][],

    ctaTitle: 'Elinizde bir ürün linki mi var?',
    ctaBody: 'Sayfanın en üstüne yapıştırın ve kimin ürettiğini görün.',
    ctaButton: 'Üreticileri bul',
  },
});
