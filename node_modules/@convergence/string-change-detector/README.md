# String Change Detector
[![Build Status](https://travis-ci.org/convergencelabs/string-change-detector.svg?branch=master)](https://travis-ci.org/convergencelabs/string-change-detector)

This module provides a utility that helps generate granular changes to a string. The StringChangeDetector tracks the current / last known value of the string.  After a single edit, the new value can be passed to the StringChangeDetector and the detector will determine the changed made to the string can execute callbacks that communicated them in terms of discrete modifications.

Unlike a more generalized diff, the utility assumes that the new and old values differ by only one single edit. This allows the logic to be more performant than a regular diff algorithm.

## Installation
`npm install --save @string-change-detector`
<br/> 
or
<br/>
`npm install --save-dev @convergence/string-change-detector`

## Example Usage

```JavaScript
const detector = new StringChangeDetector({
  value: "Hello World",
  onInsert: function(index, value) {
    console.log("'" + value + "' was inserted at index " + index);
    console.log("The value is now: '" + detector.getValue() + "'");
  }, onRemove: function(index, length) {
    console.log(length + " characters were removed at index " + index);
    console.log("The value is now: '" + detector.getValue() + "'");
  }
});

detector.processNewValue("Hello Jim");
```

Outputs:

```
5 characters were removed at index 6
The value is now: 'Hello '
'Jim' was inserted at index 6
The value is now: 'Hello Jim'
```

## API
```JavaScript
constructor(options)
```
Constructs a new StringChangeDetector.

```JavaScript
insertText(index, value)
```
Updates the current value by inserting characters at the specified index.

```JavaScript
removeText(index, length)
```
Removes the specified number of characters at the specified index.
  
```JavaScript
setValue(value)
```
Sets the current value.
  
```JavaScript
getValue()
```
Gets the current value of the string.

```JavaScript
processNewValue(newValue)
```
Processes a new string that is the result of a single modification from the current value.  Will fire the onInsert and onRemove callbacks as appropriate.
