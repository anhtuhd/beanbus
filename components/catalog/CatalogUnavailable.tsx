import Link from 'next/link';
import { CircleAlert, RefreshCw } from 'lucide-react';
import { LocalizedText } from '@/components/ui/LocalizedText';

type Props = {
  retryHref: string;
  title: string;
  description: string;
};

export default function CatalogUnavailable({ retryHref, title, description }: Props) {
  return (
    <main className="wrap catalogUnavailable" role="alert" aria-live="assertive">
      <CircleAlert size={24} aria-hidden="true" />
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="errorActions">
          <Link href={retryHref} className="btn btn-primary">
            <RefreshCw size={16} aria-hidden="true" />
            <LocalizedText vi="Thử lại" en="Try again" />
          </Link>
          <Link href="/contact" className="btn btn-dark"><LocalizedText vi="Liên hệ Beanbus" en="Contact Beanbus" /></Link>
        </div>
      </div>
    </main>
  );
}
