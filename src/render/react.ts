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

  toHTML(component: any, data: any): string {
    return ReactDOMServer.renderToString(React.createElement(component, data));
  }

  attach(component: any, data: any, parent: Element | DocumentFragment): any {
    let el = React.createElement(component, data);
    ReactDOM.hydrate(el, parent);
    return el;
  }

  insert(component: any, data: any, parent: Element | DocumentFragment): any {
    let el = React.createElement(component, data);
    ReactDOM.render(el, parent);
    return el;
  }

  update(component: any, data: any, parent: Element | DocumentFragment): void {
    // todo will this work?
    component.setState(data);
  }

  remove(component: any, parent: Element | DocumentFragment): void {
    ReactDOM.unmountComponentAtNode(parent);
  }
}
