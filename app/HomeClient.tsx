'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createCustomerRequest } from '@/app/request-actions';
import { useLanguage } from '@/context/LanguageContext';
import type { Product } from '@/data/products';
import { COFFEE_BEANS, CoffeeBean } from '@/data/beans';
import { ProductCustomizerModal } from '@/components/ui/ProductCustomizerModal';
import { useDialogFocus } from '@/lib/ui/use-dialog-focus';
import { withSupportReference } from '@/lib/observability/support-reference';
import { BRAND_ASSETS } from '@/lib/brand/assets';
import {
  Coffee,
  Sparkles,
  Users,
  Award,
  Clock,
  ChevronRight,
  ShoppingBag,
  Maximize2,
  X,
  CheckCircle,
  LoaderCircle,
  Send,
} from 'lucide-react';
import styles from './page.module.css';

const isProduction = process.env.NEXT_PUBLIC_APP_MODE === 'production';

export default function HomeClient({ products }: { products: Product[] }) {
  const { t, lang } = useLanguage();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quoteSubmitted, setQuoteSubmitted] = useState(false);
  const [quoteBean, setQuoteBean] = useState<CoffeeBean | null>(null);
  const [quoteName, setQuoteName] = useState('');
  const [quotePhone, setQuotePhone] = useState('');
  const [quoteOrganization, setQuoteOrganization] = useState('');
  const [quoteVolume, setQuoteVolume] = useState<'10_30' | '30_100' | 'over_100'>('10_30');
  const [quoteConsent, setQuoteConsent] = useState(false);
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [quoteReference, setQuoteReference] = useState('');
  const quoteIdempotencyKey = useRef<string | null>(null);

  const bestSellers = products.filter((p) => p.badge === 'best' || p.badge === 'signature').slice(0, 4);

  const galleryImages = [
    { src: BRAND_ASSETS.galleryOne, caption: 'Không gian quán Beanbus Hải Phòng' },
    { src: BRAND_ASSETS.galleryTwo, caption: 'Trạm pha chế Espresso Bar' },
    { src: BRAND_ASSETS.galleryThree, caption: 'Cupping & Nếm thử cà phê tại xưởng' },
    { src: BRAND_ASSETS.galleryFour, caption: 'Khách hàng thưởng thức đồ uống tại Beanbus' },
  ];

  const handleOpenQuote = (bean?: CoffeeBean) => {
    quoteIdempotencyKey.current = null;
    setQuoteBean(bean || null);
    setQuoteModalOpen(true);
    setQuoteSubmitted(false);
    setQuoteName('');
    setQuotePhone('');
    setQuoteOrganization('');
    setQuoteVolume('10_30');
    setQuoteConsent(false);
    setQuoteError('');
    setQuoteReference('');
  };

  const closeQuote = () => {
    if (quoteSubmitting) return;
    setQuoteModalOpen(false);
  };
  const quoteDialogRef = useDialogFocus<HTMLDivElement>(quoteModalOpen, closeQuote);
  const lightboxRef = useDialogFocus<HTMLDivElement>(Boolean(lightboxImg), () => setLightboxImg(null));

  const handleSendQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quoteSubmitting) return;
    setQuoteError('');

    if (isProduction) {
      setQuoteSubmitting(true);
      quoteIdempotencyKey.current ??= crypto.randomUUID();
      try {
        const result = await createCustomerRequest({
          type: 'b2b_quote',
          idempotencyKey: quoteIdempotencyKey.current,
          name: quoteName,
          phone: quotePhone,
          organization: quoteOrganization,
          volumeRange: quoteVolume,
          subjectReference: quoteBean?.id,
          consentToContact: quoteConsent,
        });
        if (!result.ok) {
          setQuoteError(withSupportReference(
            t('Thông tin chưa hợp lệ hoặc chưa thể gửi. Vui lòng kiểm tra và thử lại.', 'Please check your details and try again.'),
            result.reference,
            t('Mã hỗ trợ', 'Support reference')
          ));
          return;
        }
        setQuoteReference(result.request.reference);
        setQuoteSubmitted(true);
      } catch {
        setQuoteError(t('Kết nối bị gián đoạn. Vui lòng thử lại.', 'Connection interrupted. Please try again.'));
      } finally {
        setQuoteSubmitting(false);
      }
      return;
    }

    setQuoteReference(`BQ-DEMO-${Date.now().toString().slice(-6)}`);
    setQuoteSubmitted(true);
  };

  return (
    <>
      <div className={styles.noScriptNotice}>
        Trang vẫn có thể xem khi tắt JavaScript. <Link href="/menu">Xem menu</Link> · <Link href="/booking">Đặt bàn</Link> · <Link href="/contact">Liên hệ Beanbus</Link>
      </div>
      {/* ============ HERO SECTION ============ */}
      <section className={styles.hero} id="top">
        <Image
          src={BRAND_ASSETS.hero}
          alt="Không gian quán và xưởng rang Beanbus"
          fill
          priority
          sizes="100vw"
          className={styles.heroImage}
        />
        <div className={styles.heroOverlay}></div>
        <div className={`wrap ${styles.heroContent}`}>
          <div className="eyebrow eyebrow-green">
            <span>{t('Quán cà phê & xưởng rang đặc sản', 'Specialty café & coffee roastery')}</span>
          </div>
          <h1 className={styles.heroTitle}>
            <span className="lang-vi">BREW BETTER <span className={styles.accent}>EVERY DAY</span></span>
          </h1>
          <p className={styles.lede}>
            {t(
              'Ly cà phê hôm nay đến với bạn có thể chưa ngon nhất, nhưng ngày mai chắc chắn sẽ tốt hơn. Beanbus — cà phê đặc sản từ farm đến cup, ngay tại Hải Phòng.',
              'Today\'s cup might not be perfect yet — but tomorrow\'s will be better. Beanbus: specialty coffee from farm to cup, in Hải Phòng.'
            )}
          </p>
          <div className={styles.heroCta}>
            <Link href="/menu" className="btn btn-primary btn-lg">
              <ShoppingBag size={18} />
              <span>{t('Xem menu quán', 'View café menu')}</span>
            </Link>
            <a href="#beans" className="btn btn-outline btn-lg">
              <span>{t('Đặt hạt cà phê sỉ / lẻ', 'Order beans (B2B/retail)')}</span>
            </a>
            <Link href="/booking" className="btn btn-green btn-lg">
              <span>{t('Đặt bàn trước', 'Book Table')}</span>
            </Link>
          </div>
          <div className={styles.heroTag}>Brew Better Every Day</div>
        </div>
      </section>

      {/* ============ STAT STRIP ============ */}
      <div className={styles.statStrip}>
        <div className={`wrap ${styles.statWrap}`}>
          <div className={styles.statItem}>
            <Sparkles className={styles.statIcon} />
            <div>
              <div className={styles.statTitle}>{t('Từ Farm đến Cup', 'From Farm to Cup')}</div>
              <div className={styles.statDesc}>{t('Hệ sinh thái cà phê đầy đủ', 'A complete coffee ecosystem')}</div>
            </div>
          </div>
          <div className={styles.statItem}>
            <Users className={styles.statIcon} />
            <div>
              <div className={styles.statTitle}>{t('Cộng đồng đặc sản', 'Specialty Community')}</div>
              <div className={styles.statDesc}>{t('Hải Phòng & xa hơn nữa', 'Hải Phòng & beyond')}</div>
            </div>
          </div>
          <div className={styles.statItem}>
            <Award className={styles.statIcon} />
            <div>
              <div className={styles.statTitle}>{t('Rang gia công B2B', 'Contract Roasting B2B')}</div>
              <div className={styles.statDesc}>{t('Cho quán cà phê & nhà rang', 'For cafés & roasters')}</div>
            </div>
          </div>
          <div className={styles.statItem}>
            <Clock className={styles.statIcon} />
            <div>
              <div className={styles.statTitle}>07:00 – 23:00</div>
              <div className={styles.statDesc}>{t('Mở cửa tất cả các ngày', 'Open every day')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ============ STORY SECTION ============ */}
      <section className={styles.storySection} id="story">
        <div className="wrap">
          <div className={styles.storyGrid}>
            <div className={styles.storyImgWrap}>
              <Image
                src={BRAND_ASSETS.story}
                alt="Beanbus Coffee Roaster signage"
                width={800}
                height={700}
                sizes="(max-width: 900px) 100vw, 50vw"
                className={styles.storyImg}
              />
              <div className={styles.storyBadge}>
                <span className={styles.badgeNumber}>2022</span>
                <span className={styles.badgeLabel}>{t('Thành lập', 'Established')}</span>
              </div>
            </div>

            <div className={styles.storyText}>
              <div className="eyebrow">
                <span>{t('Câu chuyện thương hiệu', 'Brand Story')}</span>
              </div>
              <h2 className="section-title">
                {t(
                  'Người bị cà phê "chơi", chứ không phải người chơi cà phê',
                  'Played by coffee, not just playing with it'
                )}
              </h2>
              <p>
                {t(
                  'Beanbus ra đời vào cuối năm 2022, bởi Hiếu Bean — một chàng trai bị cà phê chơi chứ không phải chơi cà phê nữa. Niềm đam mê với cà phê mang đến cho anh một khát khao cống hiến cho ngành cà phê Việt Nam.',
                  'Beanbus was born in late 2022, founded by Hiếu Bean — a man who got "played" by coffee rather than just playing with it. That passion sparked a drive to contribute to Vietnam\'s coffee industry.'
                )}
              </p>
              <p>
                {t(
                  'Nghiêm túc trau dồi chuyên môn, chuyên nghiệp trong câu chuyện thương hiệu, và khát khao xây dựng một cộng đồng cà phê tại Hải Dương — đó là những điều đã khai sinh ra Beanbus.',
                  'Serious about craft, professional in its brand story, and driven to build a coffee community in Hải Dương — these are the things that gave birth to Beanbus.'
                )}
              </p>
              <p>
                {t(
                  'Ngày nay, Beanbus hiện thực hóa hành trình đó tại quán & xưởng rang ở Hải Phòng — nơi câu chuyện hạt cà phê Việt được kể mỗi ngày, qua từng ly đồ uống và từng mẻ rang.',
                  'Today, Beanbus brings that journey to life at our café & roastery in Hải Phòng — where the story of Vietnamese coffee beans is told every day, through every drink and every roast.'
                )}
              </p>
              <div className={styles.storySignature}>Brew Better Every Day</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ CORE VALUES SECTION ============ */}
      <section className={styles.valuesSection}>
        <div className="wrap">
          <div className="section-head center">
            <div className="eyebrow center"><span>{t('Giá trị cốt lõi', 'Core Values')}</span></div>
            <h2 className="section-title">{t('Điều Beanbus theo đuổi', 'What Beanbus stands for')}</h2>
          </div>
          <div className={styles.valuesGrid}>
            <div className={styles.valueCard}>
              <div className={styles.valueIcon}><Coffee size={28} /></div>
              <h3>{t('Hạt cà phê Việt Nam', 'Vietnamese Coffee Beans')}</h3>
              <p>{t('Thúc đẩy giá trị hạt cà phê Việt Nam, từ Robusta Gia Lai đến Arabica đặc sản các vùng cao.', 'Promoting the value of Vietnamese coffee beans, from Gia Lai Robusta to specialty highland Arabica.')}</p>
            </div>
            <div className={styles.valueCard}>
              <div className={styles.valueIcon}><Users size={28} /></div>
              <h3>{t('Cộng đồng cà phê sạch', 'Clean Coffee Community')}</h3>
              <p>{t('Xây dựng cộng đồng yêu cà phê sạch, cà phê đặc sản tại Hải Phòng và xa hơn nữa.', 'Building a community of clean & specialty coffee lovers in Hải Phòng and beyond.')}</p>
            </div>
            <div className={styles.valueCard}>
              <div className={styles.valueIcon}><Sparkles size={28} /></div>
              <h3>{t('From Farm to Cup', 'From Farm to Cup')}</h3>
              <p>{t('Mang đến hệ sinh thái đầy đủ nhất về ngành: rang gia công, bán lẻ hạt, và quán cà phê.', 'A complete coffee ecosystem: contract roasting, retail beans, and café experience.')}</p>
            </div>
            <div className={styles.valueCard}>
              <div className={styles.valueIcon}><Award size={28} /></div>
              <h3>{t('Chuyên nghiệp & tận tâm', 'Professional & Dedicated')}</h3>
              <p>{t('Nghiêm túc trau dồi chuyên môn rang & pha chế trong từng mẻ, từng ly cà phê.', 'Seriously honing roasting & brewing craft in every batch, every single cup.')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ MENU HIGHLIGHTS SECTION ============ */}
      <section className={styles.menuSection} id="menu">
        <div className="wrap">
          <div className="section-head">
            <div className="eyebrow"><span>{t('Tại quán', 'At the café')}</span></div>
            <h2 className="section-title">{t('Menu đồ uống & bánh tươi', 'Drinks & Fresh Pastry Menu')}</h2>
            <p className="section-sub">
              {t(
                'Espresso bar, cold-brew, cold-drip, trà, matcha, chocolate, juice và bánh tươi mỗi ngày. Giá đã bao gồm thuế.',
                'Espresso bar, cold-brew, cold-drip, tea, matcha, chocolate, juice and fresh pastries daily.'
              )}
            </p>
          </div>

          <div className={styles.highlightGrid}>
            {bestSellers.map((item, index) => (
              <div key={item.id} className={styles.dishCard}>
                {item.badge && (
                  <span className={styles.bestBadge}>
                    {item.badge === 'best' ? 'Best Seller' : 'Signature'}
                  </span>
                )}
                <div className={styles.dishImgBox}>
                  <Image
                    src={item.image}
                    alt={lang === 'en' ? item.nameEn : item.nameVi}
                    width={640}
                    height={400}
                    unoptimized
                    loading={index === 0 ? 'eager' : 'lazy'}
                    sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 25vw"
                    className={styles.dishImg}
                  />
                </div>
                <div className={styles.dishContent}>
                  <h4>{lang === 'en' ? item.nameEn : item.nameVi}</h4>
                  <span className={styles.dishNote}>
                    {lang === 'en' ? item.descriptionEn : item.descriptionVi}
                  </span>
                  <div className={styles.dishFooter}>
                    <span className={styles.dishPrice}>
                      {item.price.toLocaleString('vi-VN')}đ
                    </span>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setSelectedProduct(item)}
                    >
                      {t('+ Chọn', '+ Select')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.menuCtaRow}>
            <div className={styles.ctaTxt}>
              <h3>{t('Xem đầy đủ thực đơn quán', 'See the full café menu')}</h3>
              <p>{t('Hơn 30 món đồ uống & bánh — chạm để xem chi tiết giá', '30+ drinks & pastries — tap to see full pricing')}</p>
            </div>
            <Link href="/menu" className="btn btn-primary">
              <span>{t('Xem toàn bộ menu', 'View Full Menu')}</span>
              <ChevronRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ============ BEANS B2B SECTION ============ */}
      <section className={styles.beansSection} id="beans">
        <div className="wrap">
          <div className="section-head">
            <div className="eyebrow"><span>{t('Hạt cà phê rang', 'Roasted Beans')}</span></div>
            <h2 className="section-title">{t('Bán sỉ cho quán & bán lẻ về nhà', 'Wholesale for cafés & retail for home')}</h2>
            <p className="section-sub">
              {t(
                'Rang gia công & cung cấp hạt cho quán cà phê, cộng đồng cà phê đặc sản, và người yêu cà phê pha tại nhà.',
                'Contract roasting & bean supply for cafés, the specialty coffee community, and home brewers.'
              )}
            </p>
          </div>

          <div className={styles.beansFlex}>
            {/* BEANS TABLE */}
            <div className={styles.beansTableWrap}>
              <table className={styles.beansTable}>
                <thead>
                  <tr>
                    <th>{t('Hạt cà phê', 'Coffee')}</th>
                    <th>{t('Hương vị', 'Tasting notes')}</th>
                    <th>{t('Giá lẻ', 'Price')}</th>
                    <th>{t('Thao tác', 'Action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {COFFEE_BEANS.map((bean) => (
                    <tr key={bean.id}>
                      <td className={styles.nameTd}>
                        <strong>{bean.name}</strong>
                        <span className={styles.originSub}>{bean.origin}</span>
                      </td>
                      <td className={styles.noteTd}>{bean.tastingNotes}</td>
                      <td className={styles.priceTd}>
                        {(bean.priceRetail250g / 1000).toFixed(0)}k/250g
                      </td>
                      <td>
                        <button
                          className={styles.quoteBtn}
                          onClick={() => handleOpenQuote(bean)}
                        >
                          {t('Nhận giá sỉ', 'Wholesale Quote')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* B2B PANEL */}
            <div className={styles.b2bPanel}>
              <h3>{t('Đặt sỉ cho quán cà phê', 'Wholesale for your café')}</h3>
              <ul>
                <li>
                  <CheckCircle size={18} className={styles.checkIcon} />
                  <span>{t('Rang gia công theo profile riêng cho từng quán', 'Custom roast profiles tailored to your café')}</span>
                </li>
                <li>
                  <CheckCircle size={18} className={styles.checkIcon} />
                  <span>{t('Hỗ trợ tư vấn menu & pha chế cho đối tác B2B', 'Menu & brewing consultation for B2B partners')}</span>
                </li>
                <li>
                  <CheckCircle size={18} className={styles.checkIcon} />
                  <span>{t('Giao hàng định kỳ, giá ưu đãi theo sản lượng', 'Recurring delivery, volume-based pricing')}</span>
                </li>
                <li>
                  <CheckCircle size={18} className={styles.checkIcon} />
                  <span>{t('Hạt lẻ 250g/1kg cho người yêu cà phê pha tại nhà', 'Retail 250g/1kg bags for home brewers')}</span>
                </li>
              </ul>
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => handleOpenQuote()}
              >
                <span>{t('Liên hệ báo giá sỉ B2B', 'Request B2B Quote')}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ============ GALLERY & LIGHTBOX SECTION ============ */}
      <section className={styles.gallerySection}>
        <div className="wrap">
          <div className="section-head">
            <div className="eyebrow"><span>{t('Không gian quán', 'The Space')}</span></div>
            <h2 className="section-title">{t('Một góc nhỏ cho người yêu cà phê', 'A little corner for coffee lovers')}</h2>
          </div>
          <div className={styles.galleryGrid}>
            {galleryImages.map((img, idx) => (
              <button key={idx} type="button" className={styles.galleryCard} onClick={() => setLightboxImg(img.src)} aria-label={`${t('Xem ảnh', 'View image')}: ${img.caption}`}>
                <Image
                  src={img.src}
                  alt={img.caption}
                  width={640}
                  height={480}
                  sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 25vw"
                  className={styles.galleryImg}
                />
                <div className={styles.galleryOverlay}>
                  <Maximize2 size={24} color="#fff" />
                  <span>{img.caption}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ============ LIGHTBOX MODAL ============ */}
      {lightboxImg && (
        <div ref={lightboxRef} className={styles.lightbox} onClick={() => setLightboxImg(null)} role="dialog" aria-modal="true" aria-label={t('Xem ảnh không gian Beanbus', 'Beanbus gallery image')} tabIndex={-1}>
          <button className={styles.lightboxClose} onClick={() => setLightboxImg(null)} aria-label={t('Đóng ảnh', 'Close image')}>
            <X size={32} />
          </button>
          <Image
            src={lightboxImg}
            alt={t('Ảnh không gian Beanbus phóng lớn', 'Enlarged Beanbus gallery view')}
            width={1200}
            height={900}
            sizes="90vw"
            className={styles.lightboxImg}
          />
        </div>
      )}

      {/* ============ PRODUCT CUSTOMIZER MODAL ============ */}
      {selectedProduct && (
        <ProductCustomizerModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}

      {/* ============ B2B QUOTE MODAL ============ */}
      {quoteModalOpen && (
        <div className={styles.lightbox} onClick={closeQuote}>
          <div ref={quoteDialogRef} className={styles.modalContent} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="quote-title" tabIndex={-1}>
            <div className={styles.modalHeader}>
              <h3 id="quote-title">{t('Yêu Cầu Báo Giá Cà Phê Sỉ (B2B)', 'Request B2B Wholesale Quote')}</h3>
              <button onClick={closeQuote} aria-label={t('Đóng', 'Close')} disabled={quoteSubmitting}><X size={20} /></button>
            </div>
            {quoteSubmitted ? (
              <div className={styles.submittedSuccess}>
                <CheckCircle size={48} color="#10b981" />
                <h4>{t('Đã nhận yêu cầu báo giá', 'Quote Request Received')}</h4>
                <p className={styles.reference}>{t('Mã yêu cầu:', 'Request reference:')} <strong>{quoteReference}</strong></p>
                <p>{t('Beanbus đã lưu thông tin. Nhân viên sẽ liên hệ sau khi xem nhu cầu sản lượng của bạn.', 'Beanbus saved your request. A team member will contact you after reviewing your volume needs.')}</p>
                <button className="btn btn-dark btn-sm" onClick={closeQuote}>{t('Đóng', 'Close')}</button>
              </div>
            ) : (
              <form onSubmit={handleSendQuote} className={styles.quoteForm}>
                {quoteBean && (
                  <div className={styles.beanSelectedInfo}>
                    <Coffee size={16} /> {t('Hạt đã chọn:', 'Selected Bean:')} <strong>{quoteBean.name}</strong>
                  </div>
                )}
                <div className={styles.inputGroup}>
                  <label htmlFor="quote-name">{t('Họ và tên của bạn', 'Your Name')} *</label>
                  <input id="quote-name" type="text" required placeholder="Nguyễn Văn A" value={quoteName} onChange={(event) => setQuoteName(event.target.value)} />
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor="quote-phone">{t('Số điện thoại liên hệ', 'Phone Number')} *</label>
                  <input id="quote-phone" type="tel" required placeholder="0937 xxx xxx" value={quotePhone} onChange={(event) => setQuotePhone(event.target.value)} />
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor="quote-organization">{t('Tên Quán Cà Phê / Đơn vị', 'Café / Business Name')}</label>
                  <input id="quote-organization" type="text" placeholder="Ví dụ: Beanbus Coffee Hải Phòng" value={quoteOrganization} onChange={(event) => setQuoteOrganization(event.target.value)} />
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor="quote-volume">{t('Sản lượng dự kiến / Tháng', 'Estimated kg/month')}</label>
                  <select id="quote-volume" value={quoteVolume} onChange={(event) => setQuoteVolume(event.target.value as typeof quoteVolume)}>
                    <option value="10_30">10kg - 30kg / {t('tháng', 'month')}</option>
                    <option value="30_100">30kg - 100kg / {t('tháng', 'month')}</option>
                    <option value="over_100">{t('Trên 100kg / tháng', 'Over 100kg / month')}</option>
                  </select>
                </div>

                <label className={styles.consentRow}>
                  <input type="checkbox" checked={quoteConsent} onChange={(event) => setQuoteConsent(event.target.checked)} required />
                  <span>{t('Tôi đồng ý để Beanbus liên hệ về yêu cầu báo giá này.', 'I agree that Beanbus may contact me about this quote request.')}</span>
                </label>

                {quoteError && <p className={styles.submitError} role="alert">{quoteError}</p>}

                <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }} disabled={quoteSubmitting}>
                  {quoteSubmitting ? <LoaderCircle size={18} className={styles.spinner} /> : <Send size={18} />}
                  <span>{quoteSubmitting ? t('Đang gửi...', 'Sending...') : t('Gửi Yêu Cầu Báo Giá', 'Submit Quote Request')}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
