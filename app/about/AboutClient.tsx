'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/context/LanguageContext';
import { BRAND_ASSETS } from '@/lib/brand/assets';
import { ChevronRight } from 'lucide-react';
import styles from './about.module.css';

export default function AboutClient() {
  const { t, lang } = useLanguage();

  const processSteps = [
    {
      num: '01',
      titleVi: 'Tuyển Chọn Nhân Xanh Special',
      titleEn: 'Specialty Green Bean Selection',
      descVi: 'Hợp tác trực tiếp với các nông hộ Gia Lai, Lâm Đồng & nhập khẩu hạt đặc sản Colombia, Ethiopia.',
      descEn: 'Direct trade with Gia Lai & Lâm Đồng farmers plus specialty imports from Colombia, Ethiopia.',
    },
    {
      num: '02',
      titleVi: 'Xây Dựng Roast Profile Riêng',
      titleEn: 'Custom Roast Profile Design',
      descVi: 'Mỗi dòng hạt được chạy máy rang kiểm soát nhiệt độ thông minh, tinh chỉnh đến từng độ C.',
      descEn: 'Each bean origin gets a tailored temperature profile, tuned to perfection.',
    },
    {
      num: '03',
      titleVi: 'Cupping Kiểm Định Chất Lượng',
      titleEn: 'Standard CQI Cupping',
      descVi: '100% mẻ rang được thử nếm theo thang chuẩn CQI trước khi đóng gói hoặc phục vụ tại quán.',
      descEn: '100% batches undergo strict cupping evaluation before packaging or brewing.',
    },
    {
      num: '04',
      titleVi: 'Pha Chế Tận Tâm Đến Khách Hàng',
      titleEn: 'Dedicated Barista Brewing',
      descVi: 'Chiết xuất từ tâm huyết của Barista, mang đến trải nghiệm ly cà phê trọn vẹn nhất.',
      descEn: 'Handcrafted by passionate baristas for the perfect cup of coffee.',
    },
  ];

  return (
    <div className={styles.aboutPage}>
      {/* BANNER */}
      <div className={styles.pageHeader}>
        <div className="wrap">
          <div className="eyebrow eyebrow-green">
            <span>{t('Về thương hiệu Beanbus', 'About Beanbus')}</span>
          </div>
          <h1 className={styles.title}>{t('Hành Trình Brew Better Every Day', 'The Journey of Brew Better Every Day')}</h1>
          <p className={styles.subTitle}>
            {t(
              'Khởi đầu từ niềm đam mê cháy bỏng với cà phê Việt Nam, phát triển thành quán & xưởng rang đặc sản hàng đầu tại Hải Phòng.',
              'Starting from a burning passion for Vietnamese coffee, growing into a premier specialty café & roastery.'
            )}
          </p>
        </div>
      </div>

      <div className="wrap">
        {/* STORY DETAILED GRID */}
        <div className={styles.storySection}>
          <div className={styles.storyGrid}>
            <div className={styles.textSide}>
              <div className="eyebrow"><span>{t('Khởi nguồn', 'The Origin')}</span></div>
              <h2>{t('Từ Hải Dương đến xưởng rang Hải Phòng', 'From Hải Dương to Hải Phòng Roastery')}</h2>
              <p>
                {t(
                  'Beanbus ra đời vào cuối năm 2022 bởi Hiếu Bean — một người tự nhận mình là "kẻ bị cà phê chơi chứ không chỉ chơi cà phê". Nhận thấy tiềm năng vô tận của hạt cà phê Việt Nam nhưng thường bị coi là giá rẻ, anh quyết tâm xây dựng một thương hiệu cà phê mộc, sạch và minh bạch từ nguồn gốc.',
                  'Beanbus was founded in late 2022 by Hiếu Bean — a man played by coffee. Recognizing the vast potential of Vietnamese coffee beans, he set out to build an authentic, clean and transparent brand.'
                )}
              </p>
              <p>
                {t(
                  'Nghiêm túc trong việc nâng cao kỹ năng rang cupping, chuyên nghiệp trong xây dựng hình ảnh thương hiệu và khát khao truyền cảm hứng cho cộng đồng yêu cà phê — đó là chiếc kim chỉ nam giúp Beanbus vững bước.',
                  'Serious about roasting expertise, professional in brand identity, and driven to inspire the coffee community — this is our guiding compass.'
                )}
              </p>
            </div>

            <div className={styles.imgSide}>
              <Image
                src={BRAND_ASSETS.story}
                alt="Beanbus Roastery"
                width={800}
                height={600}
                sizes="(max-width: 900px) 100vw, 50vw"
                className={styles.mainImg}
              />
            </div>
          </div>
        </div>

        {/* PROCESS STEPS */}
        <div className={styles.processSection}>
          <div className="section-head center">
            <div className="eyebrow center"><span>{t('Quy trình chất lượng', 'Quality Process')}</span></div>
            <h2 className="section-title">{t('4 Bước Từ Nông Trang Đến Ly Cà Phê', '4 Steps From Farm to Cup')}</h2>
          </div>

          <div className={styles.stepsGrid}>
            {processSteps.map((s) => (
              <div key={s.num} className={styles.stepCard}>
                <div className={styles.stepNum}>{s.num}</div>
                <h3>{lang === 'en' ? s.titleEn : s.titleVi}</h3>
                <p>{lang === 'en' ? s.descEn : s.descVi}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ROASTERY SHOWCASE */}
        <div className={styles.roasteryShowcase}>
          <div className={styles.rText}>
            <h2>🔥 {t('Xưởng Rang Cà Phê Sáng Tạo Việt', 'Cà Phê Sáng Tạo Việt Roastery')}</h2>
            <p>
              {t(
                'Beanbus vận hành xưởng rang chuyên nghiệp trang bị máy rang hiện đại kiểm soát nhiệt độ theo thời gian thực. Chúng tôi nhận rang gia công (Contract Roasting) theo roast profile độc quyền cho hơn 20+ quán cà phê đối tác tại Hải Phòng, Hà Nội và Quảng Ninh.',
                'Beanbus operates a professional roastery equipped with real-time temperature control. We provide custom contract roasting for 20+ partner cafés.'
              )}
            </p>
            <Link href="/contact" className="btn btn-primary">
              <span>{t('Đăng Ký Tư Vấn Rang Gia Công B2B', 'Contact for B2B Roasting')}</span>
              <ChevronRight size={18} />
            </Link>
          </div>
          <div className={styles.rImgBox}>
            <Image
              src={BRAND_ASSETS.roasteryOne}
              alt="Roastery machine"
              width={800}
              height={600}
              sizes="(max-width: 900px) 100vw, 50vw"
              className={styles.rImg}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
