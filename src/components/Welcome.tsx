import { useApp } from '../store/appStore';
import { Icon } from './Icon';
import logoColor from '../assets/logo-color.svg';

export function Welcome() {
  const recents = useApp((s) => s.recents);
  const appVersion = useApp((s) => s.appVersion);
  const { newProject, openProjectDialog, openProject } = useApp.getState();

  return (
    <div className="welcome">
      <div className="welcome-hero">
        <img src={logoColor} className="welcome-logo-img" alt="OpenMermaid" draggable={false} />
        <h1>OpenMermaid</h1>
        <p className="subtitle">
          Diagramas bonitos com Mermaid — desenhe no canvas ou escreva o código. Tudo offline.
        </p>
        <div className="welcome-actions">
          <button className="btn btn-primary btn-lg" onClick={() => void newProject()}>
            <Icon name="add" size={20} />
            Novo projeto
          </button>
          <button className="btn btn-soft btn-lg" onClick={() => void openProjectDialog()}>
            <Icon name="folder_open" size={20} />
            Abrir pasta…
          </button>
        </div>
      </div>

      {recents.length > 0 && (
        <div className="welcome-recents">
          <div className="recents-title">Continue de onde parou</div>
          <div className="recent-grid">
            {recents.map((p) => (
              <button key={p} className="recent-card" onClick={() => void openProject(p)}>
                <span className="recent-avatar">
                  <Icon name="folder" filled />
                </span>
                <span className="recent-info">
                  <span className="recent-name">{p.split('/').pop()}</span>
                  <span className="recent-path">{p.replace(/^\/Users\/[^/]+/, '~')}</span>
                </span>
                <Icon name="arrow_forward" className="recent-go" size={18} />
              </button>
            ))}
          </div>
        </div>
      )}

      {appVersion && <span className="welcome-version">OpenMermaid v{appVersion} · software livre (GPLv3)</span>}
    </div>
  );
}
