import Select from './select-remote'

/* istanbul ignore next */
Select.install = function(Vue) {
  Vue.component(Select.name, Select)
}

export default Select
