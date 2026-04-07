'use client';

import React, { useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import { AiOutlineDrag, AiOutlineClose, AiOutlineArrowDown } from 'react-icons/ai';
import { GiGamepad } from 'react-icons/gi';

type ControllerButton = {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  onPointerDown?: React.PointerEventHandler<HTMLButtonElement>;
  onPointerUp?: React.PointerEventHandler<HTMLButtonElement>;
  disabled?: boolean;
};

type AdaptiveControllerOverlayProps = {
  title: string;
  subtitle?: string;
  buttons: ControllerButton[];
  collapsedLabel?: string;
  initialCollapsed?: boolean;
  isNumpad?: boolean;
};

export function AdaptiveControllerOverlay({
  title,
  subtitle,
  buttons,
  collapsedLabel = 'Controls',
  initialCollapsed = false,
  isNumpad = false,
}: AdaptiveControllerOverlayProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

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
              <GiGamepad /> {title + " " + "Controller"}
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

          <div className={classnames('adaptive-controller-grid', isNumpad && 'adaptive-controller-grid-numpad',title === "2048" && 'solo-2048-controls')} role="toolbar" aria-label={title}>
            {buttons.map((button) => (
              <button
                key={button.key}
                type="button"
                className={classnames('adaptive-controller-btn', button.disabled && 'adaptive-controller-btn-disabled', isNumpad && 'adaptive-controller-btn-numpad')}
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
      )}
    </motion.div>
  );
}
