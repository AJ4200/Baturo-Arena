'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BiHeart } from 'react-icons/bi';
import {
  AiFillGithub,
  AiFillLinkedin,
  AiOutlineDatabase,
  AiOutlineSafetyCertificate,
  AiOutlineUser,
} from 'react-icons/ai';
import { FaAngleDown } from 'react-icons/fa';
import { FaCircleXmark } from 'react-icons/fa6';

type FooterBarProps = {
  isInMatch: boolean;
  googleProfileLabel?: string | null;
  hasGoogleAccount: boolean;
  hasLocalBackup: boolean;
  hasSavedGuestProfile: boolean;
};

export function FooterBar({
  isInMatch,
  googleProfileLabel,
  hasGoogleAccount,
  hasLocalBackup,
  hasSavedGuestProfile,
}: FooterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubtleRevealed, setIsSubtleRevealed] = useState(false);

  const playClick = () => {
    try {
      const audio = new Audio('/sounds/ui-click.mp3');
      audio.volume = 0.4;
      audio.play();
    } catch (error) {
      console.error(error);
    }
  };

  if (isInMatch) {
    return null;
  }

  const footerCredit = (
    <div className="site-footer-credit">
      <span className="site-footer-signature">
        Made With <BiHeart className="site-footer-heart" /> By AJ4200 © 2023
      </span>

      <nav className="site-footer-socials" aria-label="AJ4200 social links">
        <a
          href="https://github.com/AJ4200"
          target="_blank"
          rel="noreferrer"
          className="site-footer-social-link"
          aria-label="AJ4200 on GitHub"
        >
          <span className="site-footer-social-flare" aria-hidden="true" />
          <AiFillGithub className="site-footer-social-icon" />
        </a>

        <a
          href="https://www.linkedin.com/in/abel-majadibodu-5a0583193/"
          target="_blank"
          rel="noreferrer"
          className="site-footer-social-link"
          aria-label="AJ4200 on LinkedIn"
        >
          <span className="site-footer-social-flare" aria-hidden="true" />
          <AiFillLinkedin className="site-footer-social-icon" />
        </a>
      </nav>
    </div>
  );

  return (
    <footer
      className={`site-footer${isExpanded ? ' site-footer-expanded' : ' site-footer-subtle'}${
        isSubtleRevealed ? ' site-footer-revealed' : ''
      }`}
      aria-label="Site footer"
      onClick={() => {
        if (!isExpanded) {
          setIsSubtleRevealed(true);
        }
      }}
      onMouseLeave={() => setIsSubtleRevealed(false)}
    >
      <AnimatePresence mode="wait">
        {isExpanded ? (
          <motion.div
            key="expanded-footer"
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: 30,
              scale: 0.96,
            }}
            transition={{
              duration: 0.35,
              ease: 'easeOut',
            }}
            className="site-footer-panel"
          >
            {/* floating particles */}
            <div className="site-footer-particles">
              {Array.from({ length: 12 }).map((_, i) => (
                <span key={i} />
              ))}
            </div>

            <div className="site-footer-panel-head">
              {footerCredit}

              <button
                type="button"
                className="site-footer-close"
                onClick={() => {
                  playClick();
                  setIsExpanded(false);
                  setIsSubtleRevealed(false);
                }}
                aria-label="Collapse footer details"
              >
                <FaCircleXmark />
              </button>
            </div>

            <div className="site-footer-grid">
              <motion.section
                whileHover={{ y: -5, scale: 1.02 }}
                className="site-footer-card"
              >
                <strong>
                  <AiOutlineUser /> Account
                </strong>

                <p>
                  {hasGoogleAccount
                    ? `Google sign-in is connected${
                        googleProfileLabel
                          ? ` for ${googleProfileLabel}`
                          : ''
                      }.`
                    : 'Google sign-in is optional and only needed for online multiplayer.'}
                </p>

                <span className="site-footer-chip">
                  {hasSavedGuestProfile
                    ? 'Guest profile saved on this device'
                    : 'Guest profile only saves after you register a name'}
                </span>
              </motion.section>

              <motion.section
                whileHover={{ y: -5, scale: 1.02 }}
                className="site-footer-card"
              >
                <strong>
                  <AiOutlineDatabase /> Cache And Storage
                </strong>

                <p>
                  This app stores local device data like player name, player id,
                  music and animation settings, preferred game, match history,
                  local backups, and Google profile snapshot details after
                  sign-in.
                </p>

                <span className="site-footer-chip">
                  {hasLocalBackup
                    ? 'Local backup found in browser storage'
                    : 'No local backup saved right now'}
                </span>
              </motion.section>

              <motion.section
                whileHover={{ y: -5, scale: 1.02 }}
                className="site-footer-card"
              >
                <strong>
                  <AiOutlineSafetyCertificate /> Cookies And Sign-In
                </strong>

                <p>
                  Baturo Arena itself uses browser storage for most saved state.
                  Google sign-in may rely on Google-managed cookies during
                  authentication, but this UI is not setting ad-tracking cookies
                  of its own.
                </p>

                <span className="site-footer-chip">
                  Data stays client-side unless you sign in or play online
                </span>
              </motion.section>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="collapsed-footer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="site-footer-bar"
          >
            {footerCredit}

            <button
              type="button"
              className="site-footer-toggle footerfun"
              onClick={() => {
                playClick();
                setIsExpanded(true);
                setIsSubtleRevealed(false);
              }}
              aria-label="Expand footer details"
            >
              <FaAngleDown />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </footer>
  );
}
