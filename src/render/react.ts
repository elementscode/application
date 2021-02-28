import * as React from 'react';
import * as ReactDOMServer from 'react-dom/server';
import * as ReactDOM from 'react-dom';
import { IRenderEngine } from '../types';

export default class ReactRenderEngine implements IRenderEngine {
  constructor(opts: any = {}) {
  }

  match(component: any): boolean {
    return component && component.$type !== 'Template' && component.prototype && typeof component.prototype.render === 'function';
  }

  toString(component: any, data: any): string {
    return ReactDOMServer.renderToString(React.createElement(component, data));
  }

  hydrate(component: any, data: any, parent: Element | DocumentFragment): void {
    ReactDOM.hydrate(React.createElement(component, data), parent);
  }

  attach(component: any, data: any, parent: Element | DocumentFragment): any {
    ReactDOM.render(React.createElement(component, data), parent);
    return component;
  }

  update(component: any, data: any, parent: Element | DocumentFragment): void {
    // note: react will automatically update instead of replace if the existing
    // component is the same one.
    ReactDOM.render(React.createElement(component, data), parent);
  }

  detach(component: any, parent: Element | DocumentFragment): void {
    ReactDOM.unmountComponentAtNode(parent);
  }
}
