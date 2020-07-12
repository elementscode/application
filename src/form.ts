import { get, set, push } from '@elements/utils';
import { File } from './file';

export async function getFormData(form: HTMLFormElement): Promise<any> {
  let result = {};
  let controls = form.elements as HTMLFormControlsCollection;
  for (let idx = 0; idx < controls.length; idx++) {
    let el = controls[idx] as any;

    switch (el.type) {
      case 'submit':
        break;

      case 'number':
        set(result, el.name, Number.parseFloat(el.value));
        break;

      case 'checkbox':
        set(result, el.name, el.value == 'on' ? true : false);
        break;

      case 'select-multiple':
        setFromSelect(result, el as HTMLSelectElement);
        break;

      case 'file':
        await setFromFile(result, el);
        break;

      default:
        set(result, el.name, el.value);
        break;
    }
  }
  return result;
}

function setFromSelect(result: any, el: HTMLSelectElement) {
  let key = el.name;
  let opts = el.options;
  for (let idx = 0; idx < opts.length; idx++) {
    let opt = opts[idx];
    if (opt.selected) {
      push(result, key, opt.value || opt.text);
    }
  }
}

async function setFromFile(result: any, el: any): Promise<void> {
  return new Promise((resolve, reject) => {
    let key = el.name;
    let refs = 0;

    function loadFile(f, callback) {
      refs++;

      let reader = new FileReader();
      let file = new File(f.name);
      file.size = f.size;
      file.type = f.type;
      callback(file);
      reader.onerror = (e) => reject(reader.error);
      reader.onload = (e) => {
        file.body = new Uint8Array(e.target.result as ArrayBuffer);
        refs--;
        if (refs == 0) {
          resolve();
        }
      }
      reader.readAsArrayBuffer(f);
    }

    if (el.multiple) {
      for (let idx = 0; idx < el.files.length; idx++) {
        loadFile(el.files[idx], (file => push(result, key, file)));
      }
    } else if (el.files.length > 0) {
      loadFile(el.files[0], (file => set(result, key, file)));
    }

    if (refs == 0) {
      resolve();
    }
  });
}
