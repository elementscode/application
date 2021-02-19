import * as React from 'react';
import * as ReactDOMServer from 'react-dom/server';
import * as ReactDOM from 'react-dom';

export default class ReactRenderEngine {
  constructor(opts: any = {}) {
  }

  match(component: any): boolean {
    return typeof component.$type === 'undefined';
  }

  toString(component: any, data: any): string {
    return ReactDOMServer.renderToString(React.createElement(component, data));
  }

  hydrate(component: any, data: any, parent: Element | DocumentFragment): void {
    ReactDOM.hydrate(React.createElement(component, data), parent);
  }

  attach(component: any, data: any, parent: Element | DocumentFragment): void {
    ReactDOM.render(React.createElement(component, data), parent);
  }

  update(component: any, data: any, parent: Element | DocumentFragment): void {
    // note: react will automatically update instead of replace if the existing
    // component is the same one.
    ReactDOM.render(React.createElement(component, data), parent);
  }

  detach(parent: Element | DocumentFragment): void {
    ReactDOM.unmountComponentAtNode(parent);
  }
}
