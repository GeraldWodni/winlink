/* Shell Link - Reader */
/* (c)copyright 2021 by Gerald Wodni <gerald.wodni@gmail.com> */
/* TODO: this file is unfinished */
/* After I had a basic understanding of the file format,
 * I got stuck as there is no information on how the linkTargetIDList-Items are constructed,
 * so I switched to reverse engineering existing files and padding unknown information with 0s.
 * See writer.js.
 *
 * Feel free to finish this file, as it is quite far along,
 * I just do not have the time now and do not need this functionality.
 */

"use strict";

const fs = require("fs");
const common = require("./common.js");

function readLinkFlagBits( bits ) {
    return {
        hasLinkTargetIDList:        (bits & (1<< 0)) != 0,
        hasLinkInfo:                (bits & (1<< 1)) != 0,
        hasName:                    (bits & (1<< 2)) != 0,
        hasRelativePath:            (bits & (1<< 3)) != 0,
        hasWorkingDir:              (bits & (1<< 4)) != 0,
        hasArguments:               (bits & (1<< 5)) != 0,
        hasIconLocation:            (bits & (1<< 6)) != 0,
        isUnicode:                  (bits & (1<< 7)) != 0,
        forceNoLinkInfo:            (bits & (1<< 8)) != 0,
        hasExpString:               (bits & (1<< 9)) != 0,
        runInSeparateProcess:       (bits & (1<<10)) != 0,
        unused1:                    (bits & (1<<11)) != 0,
        hasDarwinID:                (bits & (1<<12)) != 0,
        runAsUser:                  (bits & (1<<13)) != 0,
        hasExpIcon:                 (bits & (1<<14)) != 0,
        noPidlAlias:                (bits & (1<<15)) != 0,
        unused2:                    (bits & (1<<16)) != 0,
        runWithShimLayer:           (bits & (1<<17)) != 0,
        forceNoLinkTrack:           (bits & (1<<18)) != 0,
        enableTargetMetadata:       (bits & (1<<19)) != 0,
        disableLinkPathTracking:    (bits & (1<<20)) != 0,
        disableKnownFolderTracking: (bits & (1<<21)) != 0,
        disableKnownFolderAlias:    (bits & (1<<22)) != 0,
        allowLinkToLink:            (bits & (1<<23)) != 0,
        unaliasOnSave:              (bits & (1<<24)) != 0,
        preferEnvironmentPath:      (bits & (1<<25)) != 0,
        keepLocalIDListForUNCTarget:(bits & (1<<26)) != 0
    }
}

function readTime( buffer, offset ) {
}

function readGuid( buffer, offset ) {
    const guid = Buffer.alloc(16);
    buffer.copy( guid, 0, offset );
    // swap byte order
    var o = 0;
    guid.writeUInt32BE( guid.readUInt32LE( o ), o ); o+= 4;
    guid.writeUInt16BE( guid.readUInt16LE( o ), o ); o+= 2;
    guid.writeUInt16BE( guid.readUInt16LE( o ), o ); o+= 2;

    var s = "";
    for( var i = 0; i < 16; i++ ) {
        let b = guid[i].toString(16);
        if( b.length == 1 )
            b = "0" + b;
        if( [ 4, 6, 8, 10 ].indexOf( i ) >= 0 )
            s += "-";
        s += b;
    }

    return {
        buffer: buffer.slice( offset, offset + 16 ),
        swapped: guid,
        string: s
    }
}

function readHeader( content ) {
    const header = {};
    var offset = 0;
    /* validate header size */
    const headerSize = content.readUInt32LE(offset);
    if( headerSize != common.header.size )
        throw new Error( "Invalid Header size, expecting 0x4C" );
    offset+=4;

    /* validate LinkCLSID */
    const linkCLSID = readGuid( content, offset ); offset += 16;
    if( linkCLSID.string != common.header.linkCLSID )
        throw new Error( "Invalid Header CLSID" );

    /* LinkFlags */
    header.linkFlags = content.readUInt32LE(offset); offset+=4;
    header.linkFlagBits = readLinkFlagBits( header.linkFlags );

    /* FileAttributes */
    header.fileAttributes = content.readUInt32LE(offset); offset+=4;

    /* Times */
    header.creationTime = readTime( content, offset ); offset += 8;
    header.accessTime   = readTime( content, offset ); offset += 8;
    header.writeTime    = readTime( content, offset ); offset += 8;

    /* File Size */
    header.fileSize     = content.readUInt32LE( offset ); offset += 4;

    /* IconIndex */
    header.iconIndex    = content.readUInt32LE( offset ); offset += 4;

    /* ShowCommand */
    header.showCommand  = content.readUInt32LE( offset ); offset += 4;

    /* HotKey */
    header.hotKey       = content.readUInt16LE( offset ); offset += 2;

    /* Reserved (ignore) */
    offset += 2; /* Reserved1 */
    offset += 4; /* Reserved2 */
    offset += 4; /* Reserved3 */

    return header;
}

function readZeroTerminatedString( buffer, offset ) {
    var s = "";
    for( var i = offset; i < buffer.length; i++ )
        if( buffer[i] == 0 )
            break;
        else
            s += String.fromCharCode(buffer[i]);
    return s;
}

function readLinkTargetIDList( content, obj ) {
    const linkTargetIDList = {
        items: []
    };
    linkTargetIDList.idListSize = content.readUInt16LE( obj.offset ); obj.offset += 2;
    const endOffset = obj.offset + linkTargetIDList.idListSize;
    while( obj.offset < endOffset ) {
        const itemIDSize = content.readUInt16LE( obj.offset ); obj.offset += 2;
        console.log( "IDList", "$" + obj.offset.toString(16), itemIDSize );
        const startOffset = obj.offset;
        if( itemIDSize == 0 )
            break;
        const data = content.slice( obj.offset, obj.offset + itemIDSize - 2 ); obj.offset += itemIDSize - 2;

        // after hunting for any information about the ItemID structure, I finally found some java examples:
        // https://github.com/DmitriiShamrikov/mslinks/blob/master/src/mslinks/data/ItemID.java
        var dOffset = 0
        const type = data[0]; dOffset++;
        const typeName = common.itemIDTypes[ type ];
        const item = {
            typeName,
            offset: startOffset
        }
        switch( typeName ) {
            case "clsid":
                item.guid = readGuid( data, 2 );
                item.clsidName = common.clsids[ item.guid.string ];
                break;
            case "file":
            case "directory":
                item.unknownByte  = data[dOffset]; dOffset++;
                item.size         = data.readUInt32LE( dOffset ); dOffset+=4;
                item.lastModified = data.readUInt32LE( dOffset ); dOffset+=4;
                item.attributes   = data.readUInt16LE( dOffset ); dOffset+=2;
                item.shortName    = readZeroTerminatedString( data, dOffset );
                item.data = data;
                break;
            default:
                item.type = type;
                item.length = itemIDSize-2;
                item.data = data;
                break;
        }

        linkTargetIDList.items.push( item );
    }

    obj.linkTargetIDList = linkTargetIDList;
}

function readString( content, obj ) {
    const length = content.readUInt16LE( obj.offset ); obj.offset += 2;
    var byteLength = length;
    if( obj.header.linkFlagBits.isUnicode )
        byteLength *= 2;

    const buffer = content.slice( obj.offset, obj.offset + byteLength ); obj.offset += byteLength;

    return {
        length,
        byteLength,
        buffer,
    }
}

function readStringData( content, obj ) {
    const stringData = {};

    // NAME_STRING
    if( obj.header.linkFlagBits.hasName )
        stringData.nameString = readString( content, obj );

    // RELATIVE_PATH
    if( obj.header.linkFlagBits.hasRelativePath )
        stringData.relativePath = readString( content, obj );

    // WORKING_DIR
    if( obj.header.linkFlagBits.hasWorkingDir )
        stringData.workingDir = readString( content, obj );

    // COMMAND_LINE_ARGUMENTS
    if( obj.header.linkFlagBits.hasArguments )
        stringData.commandLineArgumentsBuffer = readString( content, obj );

    // ICON_LOCATION
    if( obj.header.linkFlagBits.hasIconLocation )
        stringData.iconLocation = readString( content, obj );

    obj.stringData = stringData;
}

function readExtraData( content, obj ) {
    const extraData = {
        knownFolders: [],
        propertyStores: [],
        specialFolders: [],
        unknownBlocks: []
    };

    while( obj.offset < content.length ) {
        const blockSize = content.readUInt32LE( obj.offset ); obj.offset += 4;
        if( blockSize == 0 )
            break;
        const blockSignature = content.readUInt32LE( obj.offset ); obj.offset += 4;
        const blockContent = content.slice( obj.offset, obj.offset + blockSize - 8 ); obj.offset += blockSize - 8;

        switch( blockSignature ) {
            case 0xA0000002:
                // ConsoleDataBlock
                break;
            case 0xA0000004:
                // ConsoleFEDataBlock
                break;
            case 0xA0000006:
                // DarwinDataBlock
                break;
            case 0xA0000001:
                // EnvironmentVariableDataBlock
                break;
            case 0xA0000007:
                // IconEnvironmentDataBlock
                break;
            case 0xA000000B:
                // KnownFolderDataBlock
                const guid = readGuid( blockContent, 0 );
                const offset = blockContent.readUInt32LE( 16 );
                extraData.knownFolders.push({
                    guid,
                    offset,
                    folder: common.knownFolders[ guid.string ],
                    buffer: blockContent
                });
                break;
            case 0xA0000009:
                // PropertyStoreDataBlock
                extraData.propertyStores.push({
                    buffer: blockContent
                });
                break;
            case 0xA0000008:
                // ShimDataBlock
                break;
            case 0xA0000005: {
                // SpecialFolderDataBlock
                const folderId = blockContent.readUInt32LE( 0 );
                const offset = blockContent.readUInt32LE( 4 );
                extraData.specialFolders.push({
                    folderId,
                    offset
                });
                } break;
            case 0xA0000003:
                // TrackerDataBlock
                break;
            case 0xA000000C:
                // VistaAndAboveIDListDataBlock
                break;
            default:
                extraData.unknownBlocks.push( blockContent );
                break;
        }

        console.log( "BLOCK", blockSize, blockSignature.toString(16), blockContent );
    }

    obj.extraData = extraData;
}

async function readFile( filename ) {
    const content = await fs.promises.readFile( filename );

    const obj = {};
    obj.header = readHeader( content );
    obj.offset = common.header.size

    if( obj.header.linkFlagBits.hasLinkTargetIDList )
        readLinkTargetIDList( content, obj );

    readStringData( content, obj );

    readExtraData( content, obj );

    const util = require("util");
    console.log( util.inspect( obj, false, null, true ) );
    return content.length;
}


if( require.main === module ) {
    //readFile( "customers/exNewWindow.lnk" )
    readFile( "customers/one.lnk" )
    //readFile( "customers/two.lnk" )
    .then( res => console.log( res ) )
    .catch( err => console.log( "OH NOES:\n", err ) );
    //ws.create("customers/exNewWindow.lnk", { target: "%windir%/explorer.exe", args: "1" }, console.log.bind(console))
}

