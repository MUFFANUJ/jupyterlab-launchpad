// Copyright (c) Nebari Development Team.
// Distributed under the terms of the Modified BSD License.
import { caretDownEmptyThinIcon, classes } from '@jupyterlab/ui-components';
import * as React from 'react';
import { infoCircleIcon } from '../icons';
import { LaunchpadTooltip } from './tooltip';

export function CollapsibleSection(
  props: React.PropsWithChildren<{
    title: string;
    className: string;
    open: boolean;
    description?: string;
    onToggled?: (open: boolean) => void;
  }>
) {
  const [open, setOpen] = React.useState<boolean>(props.open);

  const handleToggle = (event: { currentTarget: { open: boolean } }) => {
    setOpen(event.currentTarget.open);
    if (props.onToggled) {
      props.onToggled(event.currentTarget.open);
    }
  };

  return (
    <details
      onToggle={handleToggle}
      className={classes(props.className, 'jp-CollapsibleSection')}
      open={open}
    >
      <summary>
        <div
          className="jp-CollapsibleSection-CollapserIconWrapper"
          aria-hidden="true"
        >
          <caretDownEmptyThinIcon.react className="jp-CollapsibleSection-CollapserIcon" />
        </div>
        <h3 className="jp-CollapsibleSection-Title">{props.title}</h3>
        {props.description ? (
          <LaunchpadTooltip
            className="jp-CollapsibleSection-Info"
            label={props.description}
          >
            <infoCircleIcon.react
              className="jp-CollapsibleSection-InfoIcon"
              tag="span"
              aria-hidden="true"
            />
          </LaunchpadTooltip>
        ) : null}
      </summary>
      <div className="jp-Launcher-CardGroup jp-Launcher-cardContainer">
        {props.children}
      </div>
    </details>
  );
}
