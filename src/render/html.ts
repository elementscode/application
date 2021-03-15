import * as html from '@elements/html';
import { IRenderEngine } from '../types';

export default class HtmlRenderEngine implements IRenderEngine {
  constructor(opts: any = {}) {}

  match(ctor: any): boolean {
    return ctor && (ctor.$type === 'Component');
  }

  toHTML(ctor: typeof html.Component, data: any): string {
    return html.toHTML(ctor, data);
  }

  attach(ctor: typeof html.Component, data: any, parent: Element | DocumentFragment): any {
    return html.attach(ctor, data, parent);
  }

  insert(ctor: typeof html.Component, data: any, parent: Element | DocumentFragment): any {
    return html.insert(ctor, data, parent);
  }

  update(cmp: html.Component, data: any, parent: Element | DocumentFragment): void {
    html.update(cmp, data, parent);
  }

  remove(cmp: html.Component, parent: Element | DocumentFragment): void {
    html.remove(cmp, parent);
  }
}
