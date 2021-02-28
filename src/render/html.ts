import * as html from '@elements/html';
import { IRenderEngine } from '../types';

export default class RenderHtmlEngine implements IRenderEngine {
  constructor(opts: any = {}) {}

  match(ctor: any): boolean {
    return ctor && (ctor.$type === 'Component');
  }

  toString(ctor: typeof html.Component, data: any): string {
    return html.toHTML(ctor, data);
  }

  hydrate(ctor: typeof html.Component, data: any, parent: Element | DocumentFragment): any {
    return html.hydrate(ctor, data, parent);
  }

  attach(ctor: typeof html.Component, data: any, parent: Element | DocumentFragment): any {
    return html.attach(ctor, data, parent);
  }

  update(cmp: html.Component, data: any, parent: Element | DocumentFragment): any {
    return html.update(cmp, data, parent);
  }

  detach(cmp: html.Component, parent: Element | DocumentFragment): any {
    return html.detach(cmp, parent);
  }
}
