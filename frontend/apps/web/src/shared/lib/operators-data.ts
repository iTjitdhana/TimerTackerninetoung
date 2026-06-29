export interface Operator {
  id: string
  name: string
  image: string
  position: string
}

export const OPERATORS: Operator[] = [
  {
    id: "sam",
    name: "สาม",
    image: "/images/e0-b8-aa-e0-b8-b2-e0-b8-a1.jpg",
    position: "พนักงานฝ่ายผลิต ครัวกลาง",
  },
  {
    id: "ae",
    name: "เอ",
    image: "/images/e0-b9-80-e0-b8-ad.jpg",
    position: "พนักงานฝ่ายผลิต ครัวกลาง",
  },
  {
    id: "pha",
    name: "ภา",
    image: "/images/e0-b8-a0-e0-b8-b2.jpg",
    position: "พนักงานฝ่ายผลิต ครัวกลาง",
  },
  {
    id: "toon",
    name: "ตุ่น",
    image: "/images/e0-b8-95-e0-b8-b8-e0-b9-88-e0-b8-99.jpg",
    position: "พนักงานฝ่ายผลิต ครัวกลาง",
  },
  {
    id: "arm",
    name: "อาร์ม",
    image: "/images/design-mode/%E0%B8%AD%E0%B8%B2%E0%B8%A3%E0%B9%8C%E0%B8%A1.jpg",
    position: "พนักงานฝ่ายผลิต ครัวกลาง",
  },
  {
    id: "man",
    name: "แมน",
    image: "/profiles/man.jpg",
    position: "พนักงานฝ่ายผลิต ครัวกลาง",
  },
  {
    id: "sorn",
    name: "พี่สร",
    image: "/placeholder.svg",
    position: "พนักงานฝ่ายผลิต โรงแกง",
  },
  {
    id: "jaran",
    name: "จรัญ",
    image: "/profiles/jaran.jpg",
    position: "พนักงานฝ่ายผลิต ครัวกลาง",
  },
  {
    id: "pond",
    name: "ปอนด์",
    image: "/images/pond.jpg",
    position: "พนักงานฝ่ายผลิต ครัวกลาง",
  },
  {
    id: "grace",
    name: "เกรซ",
    image: "/images/grace.jpg",
    position: "พนักงานฝ่ายผลิต ครัวกลาง",
  },
  {
    id: "opal",
    name: "โอปอล์",
    image: "/images/opal.jpg",
    position: "พนักงานฝ่ายผลิต ครัวกลาง",
  },
]

// Helper function to get operator by name
export function getOperatorByName(name: string): Operator | undefined {
  return OPERATORS.find((op) => op.name === name)
}

// Helper function to get all operator names
export function getOperatorNames(): string[] {
  return OPERATORS.map((op) => op.name)
}
