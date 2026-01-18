import { parsePcppText } from '../pcpp';

test('parsePcppText: extracts link and creates specs keys', () => {
  const text = `
PCPartPicker Part List: https://pcpartpicker.com/list/qQx3zP

CPU: AMD Ryzen 5 9600X 3.9 GHz 6-Core Processor  ($212.79 @ Amazon)
Video Card: Gigabyte GAMING OC Radeon RX 9070 XT 16 GB Video Card  ($785.73 @ Amazon)
Total: $2281.51
`;

  // inventory empty => costs become 0 (stable test)
  const res = parsePcppText(text, []);
  expect(res).not.toBeNull();
  expect(res!.link).toContain('https://pcpartpicker.com/list/qQx3zP');

  expect(res!.specs.CPU.name).toContain('AMD Ryzen 5 9600X');
  expect(res!.specs.GPU.name).toContain('Gigabyte GAMING OC Radeon RX 9070 XT');
});
