import { useEffect } from 'react';
import { useApp } from '../store/appStore';
import { Icon } from './Icon';

export function UpdateBanner() {
  const update = useApp((s) => s.update);
  const { dismissUpdate } = useApp.getState();

  // estados informativos somem sozinhos
  useEffect(() => {
    if (update.status === 'uptodate' || update.status === 'dev') {
      const t = setTimeout(dismissUpdate, 4000);
      return () => clearTimeout(t);
    }
  }, [update.status, dismissUpdate]);

  if (update.dismissed || update.status === 'idle') return null;

  if (update.status === 'available') {
    return (
      <div className="update-banner">
        <Icon name="system_update_alt" />
        <span>
          Nova versão <strong>{update.version}</strong> disponível!
        </span>
        <button className="btn btn-mint" onClick={() => void window.api.updaterDownload()}>
          Baixar atualização
        </button>
        <button className="btn btn-ghost" onClick={() => void window.api.openReleases()}>
          Ver novidades
        </button>
        <button className="icon-btn" onClick={dismissUpdate}>
          <Icon name="close" />
        </button>
      </div>
    );
  }

  if (update.status === 'downloading') {
    return (
      <div className="update-banner">
        <Icon name="downloading" />
        <span>Baixando atualização…</span>
        <div className="progress">
          <div style={{ width: `${Math.round(update.percent ?? 0)}%` }} />
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-soft)', minWidth: 34 }}>
          {Math.round(update.percent ?? 0)}%
        </span>
      </div>
    );
  }

  if (update.status === 'downloaded') {
    return (
      <div className="update-banner">
        <Icon name="task_alt" />
        <span>
          Atualização <strong>{update.version}</strong> pronta para instalar.
        </span>
        <button className="btn btn-mint" onClick={() => void window.api.updaterInstall()}>
          Reiniciar e instalar
        </button>
        <button className="icon-btn" onClick={dismissUpdate}>
          <Icon name="close" />
        </button>
      </div>
    );
  }

  if (update.status === 'error') {
    return (
      <div className="update-banner error" title={update.message}>
        <Icon name="error" />
        <span>Não foi possível atualizar automaticamente.</span>
        <button className="btn btn-ghost" onClick={() => void window.api.openReleases()}>
          Baixar manualmente
        </button>
        <button className="icon-btn" onClick={dismissUpdate}>
          <Icon name="close" />
        </button>
      </div>
    );
  }

  if (update.status === 'uptodate') {
    return (
      <div className="update-banner">
        <Icon name="task_alt" />
        <span>Você já está na versão mais recente.</span>
      </div>
    );
  }

  // dev
  return (
    <div className="update-banner">
      <Icon name="info" />
      <span>Atualizações automáticas funcionam apenas no app empacotado.</span>
    </div>
  );
}
