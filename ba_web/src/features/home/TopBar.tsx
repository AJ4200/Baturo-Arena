'use client';

import { IconContext } from 'react-icons';
import { AiFillGithub, AiFillLinkedin } from 'react-icons/ai';

export function TopBar() {
  return (
    <header className="title-topbar">
      <IconContext.Provider value={{ size: '1.8rem' }}>
        <div className="topbar-socials">
          <a
            href="https://github.com/AJ4200"
            target="_blank"
            rel="noreferrer"
            className="topbar-social-link group"
            aria-label="AJ4200 on GitHub"
          >
            <span className="topbar-social-flare" aria-hidden="true" />

            <AiFillGithub className="topbar-social-icon" />
          </a>

          <a
            href="https://www.linkedin.com/in/abel-majadibodu-5a0583193/"
            target="_blank"
            rel="noreferrer"
            className="topbar-social-link group"
            aria-label="AJ4200 on LinkedIn"
          >
            <span className="topbar-social-flare" aria-hidden="true" />

            <AiFillLinkedin className="topbar-social-icon" />
          </a>
        </div>
      </IconContext.Provider>
    </header>
  );
}
