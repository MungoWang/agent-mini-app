import Input01Example from "../components/input/input-01";
import Label01Example from "../components/label/label-01";
import MiscForms01Example from "../components/misc-forms/misc-forms-01";
import MiscForms02Example from "../components/misc-forms/misc-forms-02";
import MiscForms03Example from "../components/misc-forms/misc-forms-03";
import MiscForms04Example from "../components/misc-forms/misc-forms-04";
import MiscForms05Example from "../components/misc-forms/misc-forms-05";
import MiscForms06Example from "../components/misc-forms/misc-forms-06";
import MiscForms07Example from "../components/misc-forms/misc-forms-07";
import NumberField01Example from "../components/number-field/number-field-01";
import Slider01Example from "../components/slider/slider-01";
import { Example } from "../shared/example";

export function FormExamples() {
  return (
    <>
      <Example id="number-field" title="NumberField" hint="Plus/minus and typing">
        <NumberField01Example />
      </Example>
      <Example id="input" title="Input / Textarea">
        <MiscForms01Example />
      </Example>
      <Example id="checkbox-switch-radio" title="Checkbox / Switch / Radio">
        <MiscForms02Example />
      </Example>
      <Example id="select" title="Select / NativeSelect">
        <MiscForms03Example />
      </Example>
      <Example id="slider" title="Slider / SliderRange">
        <Slider01Example />
      </Example>
      <Example id="phone-password" title="Phone / Password / Currency / Copyable">
        <MiscForms04Example />
      </Example>
      <Example id="search-auto" title="SearchInput / Autocomplete">
        <MiscForms05Example />
      </Example>
      <Example id="tags-user-rating-color" title="TagInput / UserPicker / Rating / ColorPicker">
        <MiscForms06Example />
      </Example>
      <Example id="cascader-transfer" title="Cascader / Transfer">
        <MiscForms07Example />
      </Example>
      <Example id="field-label-label" title="Label">
        <Label01Example />
      </Example>
      <Example id="field-label-input" title="Input">
        <Input01Example />
      </Example>
    </>
  );
}
