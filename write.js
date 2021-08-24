/* Shell Link - Writer */
/* (c)copyright 2021 by Gerald Wodni <gerald.wodni@gmail.com> */
/* Check the reader for more information on how the format works.
 */
"use strict";

const fs = require("fs");
const common = require("./common.js");

class Writer {
    constructor( filename, opts ) {
        this.filename = filename;
        this.opts = opts;

        this.flags = Object.assign({
            hasLinkTargetIDList: true,
            forceNoLinkInfo: true
        }, this.opts.flags || {} );

        this.path = this.opts.directory || this.opts.file;
    }

    /* write helpers (data only) */
    async writeBuffer( b, position ) {
        await this.fd.write( b, 0, b.length, position );
        this.offset += b.length;
    }

    async writeUInt32LE( n ) {
        const b = Buffer.alloc( 4 );
        b.writeUInt32LE( n );
        await this.writeBuffer( b );
    }

    async writeUInt16LE( n, position ) {
        const b = Buffer.alloc( 2 );
        b.writeUInt16LE( n );
        await this.writeBuffer( b, position );
    }

    async writeUInt8( n ) {
        const b = Buffer.alloc( 1 );
        b.writeUInt8( n );
        await this.writeBuffer( b );
    }

    async writeAsciiHex( ascii ) {
        for( var i = 0; i < ascii.length; i+=2 ) {
            await this.writeUInt8( parseInt( ascii.substr( i, 2 ), 16 ) );
        }
    }

    async writeGuid( guid ) {
        const parts = guid.split("-");
        await this.writeUInt32LE( parseInt( parts[0], 16 ) )
        await this.writeUInt16LE( parseInt( parts[1], 16 ) )
        await this.writeUInt16LE( parseInt( parts[2], 16 ) )
        await this.writeAsciiHex( parts[3] );
        await this.writeAsciiHex( parts[4] );
    }

    /* TODO: feel free to implement, I do not care ;) */
    async writeDate( date ) {
        await this.writeBuffer( Buffer.alloc(8) );
    }

    /* semantic writers */

    async writeFlags() {
        var bits = 0;
        Object.keys( this.flags ).forEach( flagName => {
            if( this.flags[ flagName ] )
                bits |= common.flags[ flagName ];
        })
        await this.writeUInt32LE(bits);
    }

    async writeFileAttributes() {
        var attributes = common.fileAttributes.file;
        if( this.opts.directory )
            attributes = common.fileAttributes.directory;
        await this.writeUInt32LE( attributes );
    }

    async writeTimes() {
        const date = new Date();
        await this.writeDate( date );   // creation
        await this.writeDate( date );   // access
        await this.writeDate( date );   // write
    }

    async writeHeader() {
        await this.writeUInt32LE( common.header.size ); //  4: Header size
        await this.writeGuid( common.header.linkCLSID );// 16: Link CLSID
        await this.writeFlags();                        //  4: Flags
        await this.writeFileAttributes();               //  4: FileAttributes
        await this.writeTimes();                        // 24: Times

        await this.writeUInt32LE( 0 );                  //  4: FileSize
        await this.writeUInt32LE( 0 );                  //  4: IconIndex
        await this.writeUInt32LE( common.showCommand.normal ); //  4: ShowCommand
        await this.writeUInt16LE( 0 );                  //  2: HotKey

        await this.writeUInt16LE( 0 );                  //  2: Reserved1
        await this.writeUInt32LE( 0 );                  //  4: Reserved2
        await this.writeUInt32LE( 0 );                  //  4: Reserved3
    }

    async writeClsid( clsid ) {
        await this.writeUInt16LE( 2 + 1 + 1 + 16 );         //  2: item size
        await this.writeUInt8( common.itemIDTypes.clsid );  //  1: type
        await this.writeUInt8( 0x50 );                      //  1: undocumented, found in existing files
        await this.writeGuid( clsid );                      // 16: clsid
    }

    async writeDrive( drive ) {
        await this.writeUInt16LE( 2 + 1 + drive.length + 1 + 21 );
        await this.writeUInt8( common.itemIDTypes.drive );  //  1: type
        await this.writeBuffer( Buffer.from( drive ) );     //  n: length
        await this.writeUInt8( 0 );                         // 1: zero terminated string
        await this.writeBuffer( Buffer.alloc( 21 ) );       // 21: undocumented, found in existing files
    }

    async writeDirectory( directory ) {
        await this.writeUInt16LE( 2 + 1 + 11 + directory.length + 1 );
        await this.writeUInt8( common.itemIDTypes.directory );  //  1: type
        await this.writeBuffer( Buffer.alloc( 11 ) );           // 10: undocumented, found in existing files
        await this.writeBuffer( Buffer.from( directory ) );     //  n: length
        await this.writeUInt8( 0 );                             // 0: zero terminated string
    }

    async writeFile( file ) {
        await this.writeUInt16LE( 2 + 1 + 11 + file.length + 1 );
        await this.writeUInt8( common.itemIDTypes.file );       //  1: type
        await this.writeBuffer( Buffer.alloc( 11 ) );           // 10: undocumented, found in existing files
        await this.writeBuffer( Buffer.from( file ) );     //  n: length
        await this.writeUInt8( 0 );                             // 0: zero terminated string
    }

    async writePath() {
        const linkLengthOffset = this.offset;
        await this.writeUInt16LE(0x1234);                //  2: length placeholder

        // My Computer ClsID (local path)
        await this.writeClsid( common.clsids.MyComputer );

        /* TODO: if you want relative pathes, make drive and mycomputer optional */
        var [ drive, path ] = this.path.split(":");
        path = path.substring(1); // remove starting backslash
        await this.writeDrive( drive + ":\\" );

        if( this.opts.directory )
            await this.writeDirectory( path );
        else
            await this.writeFile( path );

        const endOffset = this.offset;
        const pathLength = endOffset - linkLengthOffset;
        this.writeUInt16LE( pathLength, linkLengthOffset ); // update length placeholder

        this.writeUInt16LE( 0 ) // 2: end of idListItems
    }

    async write() {
        this.fd = await fs.promises.open( this.filename, "w" );
        this.offset = 0;
        await this.writeHeader();

        await this.writePath();

        await this.fd.close();
    }
}

async function writeShellLink( filename, opts ) {
    /* TODO: check for file or dir in opts */
    /* TODO: check for minimum path-length */

    const writer = new Writer( filename, opts );
    return await writer.write();
}

async function writeFile( filename, target, opts = {} ) {
    opts.file = target;
    return await writeShellLink( filename, opts );
}

async function writeDirectory( filename, target, opts = {} ) {
    opts.directory = target;
    return await writeShellLink( filename, opts );
}

module.exports = {
    writeFile,
    writeDirectory
}

if( require.main === module ) {
    writeDirectory( "test.lnk", "C:\\temp" );
    writeFile( "a.lnk", "C:\\temp\\a.txt" );
}
