import { convert } from '../src/lib/converter'
const r = convert('classdef PGraph < matlab.mixin.Copyable')
console.log(r.python.trim())
