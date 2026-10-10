import type { Video, VideoDetail } from '@/api/schemas';
import { cn } from '@/lib/utils';

export interface CapaProps {
  video: Video | VideoDetail;
  className?: string;
}

/** Capa do vídeo. A imagem vem do TikTok e pode falhar: o fundo pêssego fica no lugar. */
export function Capa({ video: v, className }: CapaProps) {
  return (
    <span
      className={cn('relative block overflow-hidden bg-pessego', className)}
      role="img"
      aria-label="Capa do vídeo"
    >
      {v.coverUrl ? (
        <img
          src={v.coverUrl}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
        />
      ) : null}
    </span>
  );
}
