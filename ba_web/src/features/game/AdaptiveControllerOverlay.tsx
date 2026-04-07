'use client';

import React, { useState } from 'react';
import classnames from 'classnames';
import { motion } from 'framer-motion';
import { AiOutlineAppstore, AiOutlineDrag, AiOutlineClose } from 'react-icons/ai';

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
};

export function AdaptiveControllerOverlay({
  title,
  subtitle,
  buttons,
  collapsedLabel = 'Controls',
  initialCollapsed = false,
}: AdaptiveControllerOverlayProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  return (
    <motion.div
      drag
      dragMomentum={false}
      className={classnames('adaptive-controller-root', collapsed && 'adaptive-controller-collapsed')}
      initial={false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16 }}
    >
      {collapsed ? (
        <button
          className="adaptive-controller-collapsed-btn"
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label={`Expand ${collapsedLabel}`}
        >
          <AiOutlineAppstore />
        </button>
      ) : (
        <div className="adaptive-controller-card">
          <div className="adaptive-controller-header">
            <span className="adaptive-controller-title">
              <AiOutlineAppstore /> {title}
            </span>
            <div className="adaptive-controller-header-controls">
              {subtitle ? <span className="adaptive-controller-subtitle">{subtitle}</span> : null}
              <button
                className="adaptive-controller-toggle-btn"
                type="button"
                onClick={() => setCollapsed(true)}
                aria-label="Collapse controls"
              >
                <AiOutlineClose />
              </button>
            </div>
          </div>

          <div className="adaptive-controller-grid" role="toolbar" aria-label={title}>
            {buttons.map((button) => (
              <button
                key={button.key}
                type="button"
                className={classnames('adaptive-controller-btn', button.disabled && 'adaptive-controller-btn-disabled')}
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

          <div className="adaptive-controller-footer">
            <span className="adaptive-controller-drag-hint">
              <AiOutlineDrag /> Drag anywhere to reposition
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}
