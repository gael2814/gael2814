-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "pickedUpAt" TIMESTAMP(3),
ADD COLUMN     "preparingAt" TIMESTAMP(3),
ADD COLUMN     "readyAt" TIMESTAMP(3),
ADD COLUMN     "readyNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "smsOptIn" BOOLEAN NOT NULL DEFAULT false;
