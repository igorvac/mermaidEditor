import { useApp } from '../store/appStore';
import { Icon } from './Icon';

export function Welcome() {
  const recents = useApp((s) => s.recents);
  const appVersion = useApp((s) => s.appVersion);
  const { newProject, openProjectDialog, openProject } = useApp.getState();

  return (
    <div className="welcome">
      <div className="welcome-card">
        <div className="welcome-logo">
          <Icon name="account_tree" filled />
        </div>
        <h1>Mermaid Studio</h1>
        <p className="subtitle">
          Crie e edite diagramas Mermaid — visual ou por código, 100% offline.
          {appVersion ? ` · v${appVersion}` : ''}
        </p>
        <div className="welcome-actions">
          <button className="btn btn-primary" onClick={() => void newProject()}>
            <Icon name="add" size={18} />
            Novo projeto
          </button>
          <button className="btn btn-ghost" onClick={() => void openProjectDialog()}>
            <Icon name="folder_open" size={18} />
            Abrir projeto…
          </button>
        </div>
        {recents.length > 0 && (
          <div className="recents">
            <div className="recents-title">Projetos recentes</div>
            {recents.map((p) => (
              <button key={p} className="recent-row" onClick={() => void openProject(p)}>
                <Icon name="folder" filled />
                <span>
                  <span className="recent-name">{p.split('/').pop()}</span>
                  <br />
                  <span className="recent-path">{p}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
