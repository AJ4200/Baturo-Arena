'use client';

import React, { useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import { AiOutlineArrowDown, AiOutlineDrag } from 'react-icons/ai';
import { GiGamepad } from 'react-icons/gi';

export type ControllerButton = {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  onPointerDown?: React.PointerEventHandler<HTMLButtonElement>;
  onPointerUp?: React.PointerEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  slot?: 'up' | 'down' | 'left' | 'right' | 'center';
};

export type ControllerSection = {
  key: string;
  title?: string;
  subtitle?: string;
  buttons: ControllerButton[];
  layout?: 'grid' | 'dpad' | 'numpad' | 'row';
};

type AdaptiveControllerOverlayProps = {
  title: string;
  subtitle?: string;
  buttons?: ControllerButton[];
  sections?: ControllerSection[];
  collapsedLabel?: string;
  initialCollapsed?: boolean;
  isNumpad?: boolean;
};

export function AdaptiveControllerOverlay({
  title,
  subtitle,
  buttons = [],
  sections,
  collapsedLabel = 'Controls',
  initialCollapsed = false,
  isNumpad = false,
}: AdaptiveControllerOverlayProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const resolvedSections: ControllerSection[] =
    sections && sections.length > 0
      ? sections
      : [
          {
            key: 'default',
            layout: isNumpad ? 'numpad' : 'grid',
            buttons,
          },
        ];

  return (
    <motion.div
      drag
      dragMomentum={false}
      className="adaptive-controller-root"
      initial={false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16 }}
    >
      {collapsed ? (
        <button
          className={classnames('adaptive-controller-collapsed-btn', collapsed && 'adaptive-controller-collapsed')}
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label={`Expand ${collapsedLabel}`}
        >
          <GiGamepad />
        </button>
      ) : (
        <div className="adaptive-controller-card">
          <div className="adaptive-controller-header">
            <span className="room-float-anchor">
              <AiOutlineDrag /> drag
            </span>
            <span className="adaptive-controller-title">
              <GiGamepad /> {title}
            </span>
            <button
              className="adaptive-controller-toggle-btn"
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse controls"
            >
              <AiOutlineArrowDown />
            </button>
            <div className="adaptive-controller-header-controls">
              {subtitle ? <span className="adaptive-controller-subtitle">{subtitle}</span> : null}
            </div>
          </div>

          {resolvedSections.map((section) => {
            const layout = section.layout || 'grid';
            return (
              <div key={section.key} className="adaptive-controller-section">
                {section.title ? <p className="adaptive-controller-section-title">{section.title}</p> : null}
                {section.subtitle ? (
                  <p className="adaptive-controller-section-subtitle">{section.subtitle}</p>
                ) : null}
                <div
                  className={classnames(
                    'adaptive-controller-grid',
                    layout === 'numpad' && 'adaptive-controller-grid-numpad',
                    layout === 'dpad' && 'adaptive-controller-grid-dpad',
                    layout === 'row' && 'adaptive-controller-grid-row'
                  )}
                  role="toolbar"
                  aria-label={`${title} ${section.title || section.key}`}
                >
                  {section.buttons.map((button) => (
                    <button
                      key={button.key}
                      type="button"
                      className={classnames(
                        'adaptive-controller-btn',
                        button.disabled && 'adaptive-controller-btn-disabled',
                        layout === 'numpad' && 'adaptive-controller-btn-numpad',
                        layout === 'dpad' && button.slot && `adaptive-controller-btn-dpad-${button.slot}`
                      )}
                      onClick={button.onClick}
                      onPointerDown={button.onPointerDown}
                      onPointerUp={button.onPointerUp}
                      onPointerLeave={button.onPointerUp}
                      onPointerCancel={button.onPointerUp}
                      disabled={button.disabled}
                      aria-label={button.label}
                      title={button.label}
                    >
                      <span className="adaptive-controller-btn-icon">{button.icon}</span>
                      <span className="adaptive-controller-btn-label">{button.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
