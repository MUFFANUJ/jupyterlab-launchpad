import { LabIcon } from '@jupyterlab/ui-components';
import arrowUpDownSvgstr from '../style/icons/md/arrow-up-down.svg';
import starSvgstr from '../style/icons/md/star.svg';
import folderOutlineSvgstr from '../style/icons/md/folder-outline.svg';
import codeServerSvgstr from '../style/icons/code-server.svg';

export const arrowUpDownIcon = new LabIcon({
  name: 'jupyterlab-launchpad:arrow-up-down',
  svgstr: arrowUpDownSvgstr
});

export const starIcon = new LabIcon({
  name: 'jupyterlab-launchpad:star',
  svgstr: starSvgstr
});

export const folderOutlineIcon = new LabIcon({
  name: 'jupyterlab-launchpad:folder-outline',
  svgstr: folderOutlineSvgstr
});

export const codeServerIcon = new LabIcon({
  name: 'jupyterlab-launchpad:code-server',
  svgstr: codeServerSvgstr
});
