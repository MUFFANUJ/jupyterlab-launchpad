jest.mock('@jupyterlab/ui-components', () => {
  class MockLabIcon {
    react = () => null;
    constructor(public options: { name: string; svgstr: string }) {}
  }
  const icon = {
    react: () => null
  };
  return {
    checkIcon: icon,
    downloadIcon: icon,
    errorIcon: icon,
    LabIcon: MockLabIcon,
    refreshIcon: icon
  };
});

jest.mock('@jupyterlab/launcher', () => ({
  ILauncher: {}
}));

jest.mock('../handler', () => ({
  requestAPI: jest.fn(() =>
    Promise.resolve({
      uiUrl: 'https://nebi.example.com'
    })
  )
}));

import * as React from 'react';
import { LaunchpadKernelTable } from '../kernel-table';
import { NebiCommandIDs, nebiKernelTablePlugin } from '../components/nebi';
import { nebiIcon } from '../icons';
import { requestAPI } from '../handler';
import { IKernelItem } from '../types';

function activateNebiPlugin(registry: LaunchpadKernelTable) {
  const app = {
    commands: {
      addCommand: jest.fn()
    }
  };
  const translator = {
    load: () => ({
      __: (message: string) => message
    })
  };
  const launcher = {
    add: jest.fn()
  };

  nebiKernelTablePlugin.activate(
    app as never,
    translator as never,
    launcher as never,
    registry
  );
  return { app, launcher };
}

describe('LaunchpadKernelTable', () => {
  it('registers metadata columns', () => {
    const registry = new LaunchpadKernelTable();
    const column = { id: 'state', label: 'State' };
    let changes = 0;

    registry.changed.connect(() => {
      changes += 1;
    });

    registry.registerMetadataColumn(column);

    expect(registry.getMetadataColumn('state')).toBe(column);
    expect(changes).toBe(1);
  });

  it('replaces existing metadata columns with the same id', () => {
    const registry = new LaunchpadKernelTable();
    const first = { id: 'state', label: 'State' };
    const second = { id: 'state', label: 'Kernel state' };

    registry.registerMetadataColumn(first);
    registry.registerMetadataColumn(second);

    expect(registry.getMetadataColumn('state')).toBe(second);
  });

  it('registers Nebi metadata presentation', () => {
    const registry = new LaunchpadKernelTable();
    const item = {} as IKernelItem;

    activateNebiPlugin(registry);

    const state = registry.getMetadataColumn('nebi_state');
    const source = registry.getMetadataColumn('nebi_source');
    const remoteVersion = registry.getMetadataColumn('nebi_remote_version');

    expect(state?.label).toBe('Status');
    expect(source?.label).toBe('Location');
    expect(
      state?.title?.({
        item,
        metadataKey: 'nebi_state',
        value: 'local-missing-deps',
        metadata: {
          nebi_state: 'local-missing-deps',
          nebi_missing_dependencies: ['ipykernel']
        },
        trans: null as never
      })
    ).toBe(
      'Missing dependencies: ipykernel. Use the Nebi UI or Nebi CLI to add them to this workspace, then refresh kernels.'
    );
    const renderedRemoteVersion = remoteVersion?.render?.({
      item,
      metadataKey: 'nebi_remote_version',
      value: 'v2',
      metadata: {
        nebi_local_version: 'v1',
        nebi_remote_version: 'v2',
        nebi_outdated: true
      },
      trans: null as never
    });
    if (
      !React.isValidElement<{ children: React.ReactNode }>(
        renderedRemoteVersion
      )
    ) {
      throw new Error('Expected latest version to render as a React element');
    }
    expect(
      React.Children.toArray(renderedRemoteVersion.props.children).map(child =>
        React.isValidElement<{ children: React.ReactNode }>(child)
          ? child.props.children
          : child
      )
    ).toEqual(['v2', '(Latest)']);
  });

  it('supports split Nebi status and location metadata', () => {
    const registry = new LaunchpadKernelTable();

    activateNebiPlugin(registry);

    const status = registry.getMetadataColumn('nebi_status');
    const location = registry.getMetadataColumn('nebi_location');

    expect(status?.label).toBe('Status');
    expect(location?.label).toBe('Location');
  });

  it('registers a single launcher button for Nebi UI', async () => {
    jest.clearAllMocks();
    const registry = new LaunchpadKernelTable();
    const { app, launcher } = activateNebiPlugin(registry);

    await Promise.resolve();

    expect(app.commands.addCommand).toHaveBeenCalledWith(
      NebiCommandIDs.openUi,
      expect.objectContaining({
        label: 'Nebi UI',
        caption: 'Open Nebi UI',
        icon: nebiIcon
      })
    );
    expect(launcher.add).toHaveBeenCalledWith(
      expect.objectContaining({
        command: NebiCommandIDs.openUi,
        category: 'Other'
      })
    );

    const openCommand = (app.commands.addCommand as jest.Mock).mock.calls[0][1];
    const originalOpen = window.open;
    window.open = jest.fn();
    try {
      openCommand.execute();
      expect(window.open).toHaveBeenCalledWith(
        'https://nebi.example.com',
        '_blank',
        'noopener,noreferrer'
      );
    } finally {
      window.open = originalOpen;
    }
  });

  it('does not add Nebi UI button without a URL', async () => {
    jest.clearAllMocks();
    (requestAPI as jest.Mock).mockResolvedValueOnce({
      uiUrl: ''
    });
    const registry = new LaunchpadKernelTable();
    const { launcher } = activateNebiPlugin(registry);

    await Promise.resolve();

    expect(launcher.add).not.toHaveBeenCalled();
  });

  it('keeps Nebi fallback icon titles behind the Nebi plugin', () => {
    const registry = new LaunchpadKernelTable();
    const item = {} as IKernelItem;
    const options = {
      item,
      metadata: {
        nebi_logo_reason: 'Logo is missing'
      },
      trans: null as never
    };

    expect(registry.getIconFallbackTitle(options)).toBeUndefined();

    activateNebiPlugin(registry);

    expect(registry.getIconFallbackTitle(options)).toBe('Logo is missing');
  });

  it('does not register direct Nebi actions', () => {
    const registry = new LaunchpadKernelTable();
    const item = {} as IKernelItem;

    activateNebiPlugin(registry);

    const remoteActions = registry.getActions({
      item,
      metadata: {
        nebi_state: 'remote-not-pulled',
        nebi_workspace: 'demo'
      },
      trans: null as never
    });
    expect(remoteActions).toEqual([]);

    const missingDependencyActions = registry.getActions({
      item,
      metadata: {
        nebi_status: 'missing-deps',
        nebi_workspace: 'demo',
        nebi_workspace_path: '/tmp/demo',
        nebi_missing_dependencies: ['ipykernel']
      },
      trans: null as never
    });
    expect(missingDependencyActions).toEqual([]);

    const readyActions = registry.getActions({
      item,
      metadata: {
        nebi_status: 'ready',
        nebi_workspace: 'demo',
        nebi_workspace_path: '/tmp/demo'
      },
      trans: null as never
    });
    expect(readyActions).toEqual([]);
  });
});
