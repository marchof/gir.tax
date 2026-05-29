<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:xs="http://w3.org"
                exclude-result-prefixes="xs"
                expand-text="yes"
                version="3.0">
  
  <xsl:output method="html" html-version="5.0" encoding="UTF-8" indent="yes"/>
  
  <xsl:variable name="girenums">
    <enum id="GIR101">The message only contains new information</enum>
    <enum id="GIR102">The message contains corrections/deletions for previously sent information</enum>
    <enum id="GIR103">The message advises there is no data to report</enum>
  </xsl:variable>
  
  <xsl:key name='girenums-map' match='enum' use='@id' />
  
  <!-- Root template sets up the HTML page and embeds CSS -->
  <xsl:template match="/">
    <html>
      <head>
        <title>Syntax Highlighted XML</title>
        <style>
          div.xml-code { font-family: monospace; background: #f8f9fa; border-radius: 5px; padding-left: 20px; line-height: 1.7; }
          .xml-tag { color: #aaa; background: #e0e0e0; padding: 2px 4px; border-radius: 4px; margin: 2px; }
          .xml-tag-name { color: #9966ff; }
          .xml-attr-name { color: #ee9966; }
          .xml-attr-val { color: #000000; }
          .xml-text { color: #000000; }
          .xml-comment { color: #888888; font-style: italic; }
        </style>
        
        
      </head>
      <body>
        <div class="xml-code">
          <xsl:apply-templates/>
        </div>
      </body>
    </html>
  </xsl:template>
  
  <!-- Match XML Elements -->
  <xsl:template match="*">
    <div class="xml-code">
    <xsl:choose>
      <!-- Self-closing tag if empty -->
      <xsl:when test="not(node())">
        <span class="xml-tag">&lt;<span class="xml-tag-name"><xsl:value-of select ="name(.)"/></span><xsl:apply-templates select="@*"/>/&gt;</span>
      </xsl:when>
      <!-- Standard open/close if it has children -->
      <xsl:otherwise>
        <span class="xml-tag">&lt;<span class="xml-tag-name"><xsl:value-of select ="name(.)"/></span><xsl:apply-templates select="@*"/>&gt;</span>
        <xsl:apply-templates/>
        <span class="xml-tag">&lt;/<span class="xml-tag-name"><xsl:value-of select ="name(.)"/></span>&gt;</span>
      </xsl:otherwise>
    </xsl:choose>
    </div>
  </xsl:template>
  
  <!-- Match Attributes -->
  <xsl:template match="@*">
    <xsl:text> </xsl:text>
    <span class="xml-attr-name"><xsl:value-of select ="name(.)"/></span>
    <xsl:text>="</xsl:text>
    <span class="xml-attr-val"><xsl:value-of select ="."/></span>
    <xsl:text>"</xsl:text>
  </xsl:template>
  
  <!-- Match Text Nodes -->
  <xsl:template match="text()">
    <span class="xml-text"><xsl:value-of select ="."/></span>
    <xsl:variable name="descr" select='document("")/enum'/>
    <xsl:if test="$descr[@id = .]">
      <div class="xml-code">
        <span class="xml-comment">&lt;!-- <xsl:value-of select="$descr[@id = .]"/> --&gt;</span>
      </div>
    </xsl:if>

  </xsl:template>
  
  <!-- Match Comments -->
  <xsl:template match="comment()">
    <div class="xml-code">
    <span class="xml-comment">&lt;!--<xsl:value-of select ="."/>--&gt;</span>
    </div>
  </xsl:template>
  
</xsl:stylesheet>
