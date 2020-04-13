#!/usr/bin/env node

doc = `
Usage:
  certificate.js <reasons> [--time=<time>] [--date=<date>] [--profile=<path>] [--output=<path>]
  certificate.js -h | --help | --version

Options:
  -h --help         Show this screen.
  --version         Show version.
  --time=<time>     Going out time, foramt: HHhMM
  --date=<date>     Going out date, format: dd/mm/yyyy
  --profile=<path>  The path to the profile file.
  --output=<path>   The output path of the certificate.

Possible reasons:
  - travail
  - courses
  - sante
  - famille
  - sport
  - judiciaire
  - missions
`

'use strict'

const QRCode = require('qrcode')
const fs = require('fs')
const PDFLib = require('pdf-lib')
const {docopt} = require('docopt')

const PDFDocument = PDFLib.PDFDocument

const attestationInputPath = './data/certificate.pdf'



const generateQR = async text => {
  try {
    var opts = {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
    }
    return await QRCode.toDataURL(text, opts)
  } catch (err) {
    console.error(err)
  }
}

function pad(str) {
  return String(str).padStart(2, '0')
}

function formatDate(date) {
  year = date.getFullYear()
  month = pad(date.getMonth() + 1) // Les mois commencent à 0
  day = pad(date.getDate())
  return `${day}/${month}/${year}`
}

function formatTime(date) {
  const hour = pad(date.getHours())
  const minute = pad(date.getMinutes())
  return `${hour}h${minute}`
}

function idealFontSize(font, text, maxWidth, minSize, defaultSize) {
  let currentSize = defaultSize
  let textWidth = font.widthOfTextAtSize(text, defaultSize)
  while (textWidth > maxWidth && currentSize > minSize) {
    textWidth = font.widthOfTextAtSize(text, --currentSize)
  }
  return (textWidth > maxWidth) ? null : currentSize
}

async function generatePdf(existingPdfBytes, profile, reasons) {
  const generatedDate = new Date()
  const creationDate = formatDate(generatedDate)
  const creationHour = formatTime(generatedDate)

  const { lastname, firstname, birthday, lieunaissance, address, zipcode, town, datesortie, heuresortie } = profile
  const releaseHours = String(heuresortie).substring(0, 2)
  const releaseMinutes = String(heuresortie).substring(3, 5)

  const data = [
    `Cree le: ${creationDate} a ${creationHour}`,
    `Nom: ${lastname}`,
    `Prenom: ${firstname}`,
    `Naissance: ${birthday} a ${lieunaissance}`,
    `Adresse: ${address} ${zipcode} ${town}`,
    `Sortie: ${datesortie} a ${releaseHours}h${releaseMinutes}`,
    `Motifs: ${reasons}`,
  ].join(' ')

  const pdfDoc = await PDFDocument.load(existingPdfBytes)
  const page1 = pdfDoc.getPages()[0]

  const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica)
  const drawText = (text, x, y, size = 11) => {
    page1.drawText(text, { x, y, size, font })
  }

  drawText(`${firstname} ${lastname}`, 123, 686)
  drawText(birthday, 123, 661)
  drawText(lieunaissance, 92, 638)
  drawText(`${address} ${zipcode} ${town}`, 134, 613)

  if (reasons.includes('travail')) {
    drawText('x', 76, 527, 19)
  }
  if (reasons.includes('courses')) {
    drawText('x', 76, 478, 19)
  }
  if (reasons.includes('sante')) {
    drawText('x', 76, 436, 19)
  }
  if (reasons.includes('famille')) {
    drawText('x', 76, 400, 19)
  }
  if (reasons.includes('sport')) {
    drawText('x', 76, 345, 19)
  }
  if (reasons.includes('judiciaire')) {
    drawText('x', 76, 298, 19)
  }
  if (reasons.includes('missions')) {
    drawText('x', 76, 260, 19)
  }
  let locationSize = idealFontSize(font, profile.town, 83, 7, 11)

  if (!locationSize) {
    console.warn('Le nom de la ville risque de ne pas être affiché correctement en raison de sa longueur. ' +
      'Essayez d\'utiliser des abréviations ("Saint" en "St." par exemple) quand cela est possible.')
    locationSize = 7
  }

  drawText(profile.town, 111, 226, locationSize)

  if (reasons !== '') {
    // Date sortie
    drawText(`${profile.datesortie}`, 92, 200)
    drawText(releaseHours, 200, 201)
    drawText(releaseMinutes, 220, 201)
  }

  // Date création
  drawText('Date de création:', 464, 150, 7)
  drawText(`${creationDate} à ${creationHour}`, 455, 144, 7)

  const generatedQR = await generateQR(data)

  const qrImage = await pdfDoc.embedPng(generatedQR)

  page1.drawImage(qrImage, {
    x: page1.getWidth() - 170,
    y: 155,
    width: 100,
    height: 100,
  })

  pdfDoc.addPage()
  const page2 = await pdfDoc.getPages()[1]
  page2.drawImage(qrImage, {
    x: 50,
    y: page2.getHeight() - 350,
    width: 300,
    height: 300,
  })

  return await pdfDoc.save()
}


async function main(arguments) {
  try {
    const now = new Date()
    const todayDate = formatDate(now)
    const nowNow = formatTime(now)

    const profileFilePath = arguments['--profile'] || 'profile.json'

    const profileData = fs.readFileSync(profileFilePath)
    const profile = JSON.parse(profileData)

    const reasons = arguments['<reasons>']
    const goingOutDate = arguments['--date'] || todayDate
    const goingOutHour = arguments['--time'] || nowNow

    profile['datesortie'] = goingOutDate
    profile['heuresortie'] = goingOutHour

    const defaultOutputPath = `certificate-${profile['lastname']}-${goingOutHour}-${reasons}.pdf`
    const outputPath = arguments['--output'] || defaultOutputPath

    const existingPdfBytes = fs.readFileSync(attestationInputPath)
    const pdfBytes = fs.readFileSync(attestationInputPath)
    const pdfBlob = await generatePdf(existingPdfBytes, profile, reasons)
    fs.writeFileSync(outputPath, pdfBlob)

    console.log(`The certificate is ready: ${outputPath}`)
  } catch (err) {
    console.error('Error', err)
  }
}

var arguments = docopt(doc, {
  version: '0.1.1rc'
})

main(arguments)
