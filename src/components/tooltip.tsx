// Copyright (c) Nebari Development Team.
// Distributed under the terms of the Modified BSD License.
import { HoverBox } from '@jupyterlab/ui-components';
import * as React from 'react';

const TOOLTIP_OFFSET = 20;

export function LaunchpadTooltip(
  props: React.PropsWithChildren<{
    className?: string;
    label: string;
  }>
): React.ReactElement {
  const anchorRef = React.useRef<HTMLSpanElement>(null);
  const tooltipRef = React.useRef<HTMLDivElement | null>(null);
  const className = props.className
    ? `jp-LaunchpadTooltipAnchor ${props.className}`
    : 'jp-LaunchpadTooltipAnchor';

  const updatePosition = React.useCallback(() => {
    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip) {
      return;
    }

    const anchorRect = anchor.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const horizontalOffset = Math.round(
      anchorRect.width / 2 - tooltipRect.width / 2
    );

    HoverBox.setGeometry({
      anchor: anchorRect,
      host: document.body,
      maxHeight: 500,
      minHeight: 20,
      node: tooltip,
      offset: {
        horizontal: horizontalOffset,
        vertical: {
          above: -TOOLTIP_OFFSET
        }
      },
      privilege: 'forceAbove',
      style: window.getComputedStyle(tooltip)
    });

    const positionedRect = tooltip.getBoundingClientRect();
    const arrowLeft =
      anchorRect.left + anchorRect.width / 2 - positionedRect.left;
    tooltip.style.setProperty(
      '--jp-launchpad-tooltip-arrow-left',
      `${Math.round(arrowLeft)}px`
    );
  }, []);

  const hideTooltip = React.useCallback(() => {
    const tooltip = tooltipRef.current;
    if (tooltip) {
      tooltip.remove();
      tooltipRef.current = null;
    }
    window.removeEventListener('resize', updatePosition);
    window.removeEventListener('scroll', updatePosition, true);
  }, [updatePosition]);

  const showTooltip = React.useCallback(() => {
    if (!anchorRef.current) {
      return;
    }

    let tooltip = tooltipRef.current;
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'jp-LaunchpadTooltip';
      tooltip.setAttribute('role', 'tooltip');
      document.body.appendChild(tooltip);
      tooltipRef.current = tooltip;
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }

    tooltip.textContent = props.label;
    updatePosition();
  }, [props.label, updatePosition]);

  React.useEffect(() => {
    return () => {
      hideTooltip();
    };
  }, [hideTooltip]);

  return (
    <span
      ref={anchorRef}
      className={className}
      aria-label={props.label}
      onBlur={hideTooltip}
      onFocus={showTooltip}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      {props.children}
    </span>
  );
}
