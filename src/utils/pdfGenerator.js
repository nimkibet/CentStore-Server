export const generateReceiptPDF = (order) => {
  return new Promise((resolve, reject) => {
    resolve(Buffer.from("Mock PDF Content for Receipt"));
  });
};

export const generatePayslipPDF = (payroll) => {
  return new Promise((resolve, reject) => {
    resolve(Buffer.from("Mock PDF Content for Payslip"));
  });
};
