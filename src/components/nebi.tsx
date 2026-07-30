// Copyright (c) Nebari Development Team.
// Distributed under the terms of the Modified BSD License.
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ILauncher } from '@jupyterlab/launcher';
import { ITranslator } from '@jupyterlab/translation';
import {
  checkIcon,
  downloadIcon,
  errorIcon,
  refreshIcon
} from '@jupyterlab/ui-components';
import type { LabIcon } from '@jupyterlab/ui-components';
import type { ReadonlyJSONObject } from '@lumino/coreutils';
import * as React from 'react';
import { requestAPI } from '../handler';
import { nebiIcon } from '../icons';
import {
  IKernelIconFallbackTitleProvider,
  IKernelMetadataColumn,
  ILaunchpadKernelTable
} from '../types';

export namespace NebiCommandIDs {
  export const openUi = 'launchpad:nebi-open-ui';
}

interface INebiCapabilities {
  uiUrl?: string;
}

const NEBI_STATUS_LABELS: Record<string, string> = {
  'not-pulled': 'Not pulled',
  'not-installed': 'Not installed',
  'missing-deps': 'Missing deps',
  outdated: 'Outdated',
  ready: 'Ready'
};

const NEBI_STATUS_CLASSES: Record<string, string> = {
  'not-pulled': 'jp-NebiStatus-not-pulled',
  'not-installed': 'jp-NebiStatus-not-installed',
  'missing-deps': 'jp-NebiStatus-missing-deps',
  outdated: 'jp-NebiStatus-outdated',
  ready: 'jp-NebiStatus-ready'
};

const NEBI_STATUS_ICONS: Record<string, LabIcon> = {
  'not-pulled': downloadIcon,
  'not-installed': errorIcon,
  'missing-deps': errorIcon,
  outdated: refreshIcon,
  ready: checkIcon
};

const NEBI_LOCATION_LABELS: Record<string, string> = {
  local: 'Local',
  remote: 'Remote'
};

const NEBI_REDUNDANT_REASONS = new Set([
  'environment-not-installed',
  'kernel-not-installed',
  'local-version-behind-remote',
  'missing-dependencies',
  'workspace-not-pulled'
]);

const NEBI_METADATA_LABELS: Record<string, string> = {
  nebi_state: 'Status',
  nebi_status: 'Status',
  nebi_location: 'Location',
  nebi_missing_dependencies: 'Missing dependencies',
  nebi_local_version: 'Local version',
  nebi_remote_version: 'Remote version',
  nebi_outdated: 'Outdated?',
  nebi_not_ready_reason: 'Not ready reason',
  nebi_logo_reason: 'Logo reason',
  nebi_discovery_hash: 'Discovery hash',
  nebi_discovered_at: 'Discovered at',
  nebi_kernel_spec: 'Kernel spec',
  nebi_kernel_state: 'Kernel state',
  nebi_workspace: 'Workspace',
  nebi_workspace_path: 'Workspace path',
  nebi_source: 'Location',
  pixi_environment: 'Environment'
};

function normalizeStatus(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  switch (value) {
    case 'remote-not-pulled':
      return 'not-pulled';
    case 'local-not-installed':
      return 'not-installed';
    case 'local-missing-deps':
      return 'missing-deps';
    default:
      return value;
  }
}

function statusFromMetadata(
  metadata: ReadonlyJSONObject | undefined,
  fallback?: unknown
): string | undefined {
  return (
    normalizeStatus(metadata?.['nebi_status']) ?? normalizeStatus(fallback)
  );
}

function locationFromMetadata(
  metadata: ReadonlyJSONObject | undefined,
  fallback?: unknown
): string | undefined {
  const explicitLocation = metadata?.['nebi_location'];
  if (typeof explicitLocation === 'string' && explicitLocation.length > 0) {
    return explicitLocation;
  }

  const source = metadata?.['nebi_source'];
  if (typeof source === 'string' && source.length > 0) {
    return source;
  }

  if (typeof fallback !== 'string') {
    return undefined;
  }

  if (fallback.startsWith('remote-')) {
    return 'remote';
  }
  if (
    fallback.startsWith('local-') ||
    fallback === 'ready' ||
    fallback === 'outdated'
  ) {
    return 'local';
  }

  return undefined;
}

function renderNebiIndicator(
  label: string,
  className: string,
  icon: LabIcon
): React.ReactNode {
  return (
    <span className={`jp-NebiIndicator ${className}`}>
      <icon.react
        className="jp-NebiIndicator-icon"
        tag="span"
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}

function renderStatus(value: string): React.ReactNode {
  const label = NEBI_STATUS_LABELS[value] ?? value;
  const className = NEBI_STATUS_CLASSES[value] ?? 'jp-NebiStatus-unknown';
  const icon = NEBI_STATUS_ICONS[value] ?? errorIcon;
  return renderNebiIndicator(label, className, icon);
}

function renderLocation(value: string): React.ReactNode {
  const label = NEBI_LOCATION_LABELS[value] ?? value;
  return <span className="jp-NebiLocation">{label}</span>;
}

function missingDependenciesTitle(
  metadata: ReadonlyJSONObject | undefined
): string | undefined {
  const dependencies = missingDependencies(metadata);
  if (dependencies.length === 0) {
    return undefined;
  }

  return `Missing dependencies: ${dependencies.join(', ')}`;
}

function missingDependenciesStatusTitle(
  metadata: ReadonlyJSONObject | undefined
): string {
  const title = missingDependenciesTitle(metadata);
  const action =
    'Use the Nebi UI or Nebi CLI to add them to this workspace, then refresh kernels.';
  return title
    ? `${title}. ${action}`
    : 'This workspace is missing dependencies. Use the Nebi UI or Nebi CLI to add them to this workspace, then refresh kernels.';
}

function missingDependencies(
  metadata: ReadonlyJSONObject | undefined
): string[] {
  const value = metadata?.['nebi_missing_dependencies'];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(item => typeof item === 'string' && item.length > 0);
}

function isLatestVersion(
  id: string,
  value: unknown,
  metadata: ReadonlyJSONObject | undefined
): boolean {
  if (typeof value !== 'string' || value.length === 0 || !metadata) {
    return false;
  }

  const localVersion = metadata['nebi_local_version'];
  const remoteVersion = metadata['nebi_remote_version'];
  const outdated = metadata['nebi_outdated'];

  if (id === 'nebi_remote_version') {
    return (
      value === remoteVersion &&
      (outdated === true || typeof localVersion !== 'string')
    );
  }

  if (id === 'nebi_local_version') {
    return (
      value === localVersion &&
      outdated === false &&
      (typeof remoteVersion !== 'string' || localVersion === remoteVersion)
    );
  }

  return false;
}

function nebiStatusTitle(
  value: unknown,
  metadata: ReadonlyJSONObject | undefined
): string | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  if (value === 'missing-deps') {
    return missingDependenciesStatusTitle(metadata);
  }

  const reason = metadata?.['nebi_not_ready_reason'];
  if (typeof reason === 'string' && reason.length > 0) {
    return NEBI_REDUNDANT_REASONS.has(reason) ? '' : reason;
  }

  return '';
}

const nebiColumns: IKernelMetadataColumn[] = Object.entries(
  NEBI_METADATA_LABELS
).map(([id, label]) => ({
  id,
  label,
  title: ({ value, metadata }) => {
    if (id === 'nebi_state' || id === 'nebi_status') {
      return nebiStatusTitle(statusFromMetadata(metadata, value), metadata);
    }

    if (id === 'nebi_missing_dependencies') {
      return missingDependenciesTitle(metadata);
    }

    return undefined;
  },
  render: ({ value, metadata }) => {
    if (id === 'nebi_state' || id === 'nebi_status') {
      const status = statusFromMetadata(metadata, value);
      if (!status) {
        return '-';
      }

      return renderStatus(status);
    }

    if (id === 'nebi_source' || id === 'nebi_location') {
      const location = locationFromMetadata(metadata, value);
      if (!location) {
        return '-';
      }

      return renderLocation(location);
    }

    if (
      (id === 'nebi_local_version' || id === 'nebi_remote_version') &&
      isLatestVersion(id, value, metadata)
    ) {
      const version = value as string;
      return (
        <span
          className="jp-NebiVersion jp-mod-latest"
          title="Latest version"
          aria-label={`${version} latest version`}
        >
          <span>{version}</span>
          <span className="jp-NebiVersionLatest">(Latest)</span>
        </span>
      );
    }

    if (
      (id === 'nebi_local_version' || id === 'nebi_remote_version') &&
      typeof value === 'string' &&
      value.length > 0
    ) {
      return (
        <span className="jp-NebiVersion">
          <span>{value}</span>
        </span>
      );
    }

    if (id === 'nebi_missing_dependencies' && Array.isArray(value)) {
      if (value.length === 0) {
        return '-';
      }

      return value
        .filter(item => typeof item === 'string' && item.length > 0)
        .join(', ');
    }

    if (id === 'nebi_outdated' && typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    return undefined;
  }
}));

const nebiIconFallbackTitleProvider: IKernelIconFallbackTitleProvider = {
  id: 'nebi-logo-reason',
  title: ({ metadata }) => {
    const logoReason = metadata?.['nebi_logo_reason'];
    return typeof logoReason === 'string' && logoReason.length > 0
      ? logoReason
      : undefined;
  }
};

function registerOpenNebiUiCommand(
  app: JupyterFrontEnd,
  launcher: ILauncher,
  trans: ReturnType<ITranslator['load']>
): void {
  let uiUrl = '';

  app.commands.addCommand(NebiCommandIDs.openUi, {
    label: trans.__('Nebi UI'),
    caption: trans.__('Open Nebi UI'),
    icon: nebiIcon,
    isEnabled: () => uiUrl.length > 0,
    isVisible: () => uiUrl.length > 0,
    execute: () => {
      if (!uiUrl) {
        return;
      }
      window.open(uiUrl, '_blank', 'noopener,noreferrer');
    }
  });

  void requestAPI<INebiCapabilities>('nebi/capabilities')
    .then(capabilities => {
      if (typeof capabilities.uiUrl !== 'string' || !capabilities.uiUrl) {
        return;
      }
      uiUrl = capabilities.uiUrl;
      launcher.add({
        command: NebiCommandIDs.openUi,
        category: trans.__('Other'),
        rank: 0
      });
    })
    .catch(error => {
      console.warn('Could not load Nebi action capabilities', error);
    });
}

export const nebiKernelTablePlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-launchpad:nebi',
  description: 'Nebi kernel metadata presentation for launchpad',
  autoStart: true,
  requires: [ITranslator, ILauncher, ILaunchpadKernelTable],
  activate: (
    app,
    translator: ITranslator,
    launcher: ILauncher,
    kernelTable: ILaunchpadKernelTable
  ) => {
    const trans = translator.load('jupyterlab-launchpad');
    registerOpenNebiUiCommand(app, launcher, trans);
    kernelTable.registerIconFallbackTitleProvider(
      nebiIconFallbackTitleProvider
    );
    for (const column of nebiColumns) {
      kernelTable.registerMetadataColumn(column);
    }
  }
};
