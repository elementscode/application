import * as React from 'react';
import { get, set } from '@elements/utils';

export class Component<T = any> extends React.Component<T, T> {
  constructor(props: T) {
    super(props);
    this.state = {...props};
  }

  get<R = any>(key: string, defaultValue?: R): R {
    return get(this.state, key, defaultValue)
  }

  set(key: string, value: any): this {
    set(this.state, key, value);
    return this;
  }

  update(): this {
    this.setState(this.state);
    return this;
  }
}
